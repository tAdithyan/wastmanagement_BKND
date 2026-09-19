import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import ApiError from '../src/utils/apiError.js';
import ApiResponse from '../src/utils/apiResponse.js';

test('registration defers creation, validates profile, limits credentials and supports retries', async () => {
  let storedUser = null;
  let writes = 0;
  let validOtp = true;
  let validLocation = true;
  const document = fields => ({ ...fields, id: 'customer-id', _id: 'customer-id', toObject() { return { ...this }; } });
  const User = {
    findOne: async () => storedUser,
    findById: () => ({ select: async () => storedUser }),
    findOneAndUpdate: async (filter, update) => {
      writes++;
      storedUser = document(update.$set ? { ...storedUser, ...update.$set } : update.$setOnInsert);
      return storedUser;
    },
  };
  globalThis.registrationTest = { User, jwt, ApiError, ApiResponse, createHash };
  try {
    const middlewareSource = (await readFile(new URL('../src/middlewares/auth.middleware.js', import.meta.url), 'utf8')).replace(/^import .*$/gm, '');
    const middleware = await import(`data:text/javascript;base64,${Buffer.from('const {User,jwt,ApiError}=globalThis.registrationTest;\n' + middlewareSource).toString('base64')}`);
    Object.assign(globalThis.registrationTest, {
      ...middleware,
      verifyOTPService: async () => { if (!validOtp) throw new Error('Invalid OTP'); },
      Role: { findOne: () => ({ populate: () => ({ select: async () => ({ permissions: [] }) }) }) },
      District: { findById: async () => ({ districtCode: 7 }) },
      PRI: { exists: async () => validLocation },
      URB: { exists: async () => validLocation },
    });
    const source = (await readFile(new URL('../src/controllers/auth.controller.js', import.meta.url), 'utf8')).replace(/^import .*$/gm, '');
    const controller = await import(`data:text/javascript;base64,${Buffer.from('const {User,ApiError,ApiResponse,createHash,signToken,signRegistrationToken,verifyOTPService,Role,District,PRI,URB}=globalThis.registrationTest;\n' + source).toString('base64')}`);
    const run = async (handler, req) => {
      let result, error;
      await handler(req, { status() { return this; }, json(value) { result = value; } }, value => { error = value; });
      return { result, error };
    };
    const mobile = '+919876543210';
    const otpRequest = { body: { mobile, otp: '123456' } };
    validOtp = false;
    assert.equal((await run(controller.verifyOTP, otpRequest)).error.statusCode, 400);
    validOtp = true;
    const verified = (await run(controller.verifyOTP, otpRequest)).result.data;
    assert.equal(writes, 0);
    assert.equal(storedUser, null);
    assert.equal(verified.requiresProfileSetup, true);
    assert.equal(verified.token, undefined);
    const pendingRequest = { headers: { authorization: `Bearer ${verified.registrationToken}` } };
    assert.equal((await run(middleware.protect, pendingRequest)).error.statusCode, 401);
    assert.equal((await run(middleware.requireRegistration, pendingRequest)).error, undefined);
    assert.equal(pendingRequest.registrationMobile, mobile);
    assert.equal((await run(middleware.protectLocation, pendingRequest)).error, undefined);
    assert.equal((await run(middleware.requireRegistration, { headers: { authorization: `Bearer ${middleware.signToken('user')}` } })).error.statusCode, 401);
    const expired = jwt.sign({ mobile, purpose: 'registration' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: -1 });
    assert.equal((await run(middleware.requireRegistration, { headers: { authorization: `Bearer ${expired}` } })).error.statusCode, 401);

    const profile = { name: 'Customer', district: 'a'.repeat(24), localbodytype: 'panjayath', localbody: 'Test Panchayat', wardNo: '4', address: 'Test house', pincode: '682001' };
    const finish = body => run(controller.completeRegistration, { registrationMobile: mobile, body });
    for (const field of ['name', 'district', 'localbodytype', 'localbody', 'wardNo', 'address', 'pincode']) {
      assert.equal((await finish({ ...profile, [field]: ' ' })).error.statusCode, 400);
    }
    assert.equal((await finish({ ...profile, pincode: '123' })).error.statusCode, 400);
    validLocation = false;
    assert.equal((await finish(profile)).error.statusCode, 400);
    validLocation = true;
    assert.equal(writes, 0);
    const completed = await finish({ ...profile, role: 'ROL_1', phonenumber: '+910000000000', wallet: 9999 });
    assert.equal(completed.error, undefined);
    assert.equal(storedUser.phonenumber, mobile);
    assert.equal(storedUser.role, 'ROL_5');
    assert.equal(storedUser.wallet, undefined);
    assert.equal(storedUser.profileCompleted, true);
    assert.ok(completed.result.data.token);
    await finish(profile);
    assert.equal(writes, 1, 'retry must not create another user');
    assert.ok((await run(controller.verifyOTP, otpRequest)).result.data.token);
    assert.equal(writes, 1, 'existing login must not write user data');

    storedUser = document({ role: 'ROL_5', name: 'Guest User 1234', profileCompleted: false, phonenumber: mobile });
    assert.ok((await run(controller.verifyOTP, otpRequest)).result.data.registrationToken);
    assert.equal(writes, 1);
    await finish(profile);
    assert.equal(storedUser.name, 'Customer');
    assert.equal(storedUser.id, 'customer-id');
    assert.equal(storedUser.profileCompleted, true);
    storedUser.is_active = false;
    assert.equal((await run(controller.verifyOTP, otpRequest)).error.statusCode, 403);
  } finally {
    delete globalThis.registrationTest;
  }
});
