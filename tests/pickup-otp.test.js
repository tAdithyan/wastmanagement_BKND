import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ApiError from '../src/utils/apiError.js';
import { generateOTPService, verifyOTPService } from '../src/services/auth.service.js';
import { normalizeOtpPhone, sendPickupCode, checkPickupCode } from '../src/services/pickupOtpProvider.js';

const source = (await readFile(new URL('../src/services/pickupOtp.service.js', import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?$/gm,'').replace(/export /g,'');
const pickup = { _id:'p1', operatorId:'a1', customerId:'u1', status:'in_progress', weight:12 };
function harness(overrides={}) {
  const state = { _id:'p1',operatorId:'a1',customerId:'u1',phone:'+919876543210',weight:12,state:'pending',attempts:0,expiresAt:new Date(Date.now()+300000),verificationSid:'VEtest',...overrides };
  let checks=0;
  const matches = filter => Object.entries(filter).every(([key,value]) => {
    if(value && typeof value==='object') return ('$lt' in value ? state[key]<value.$lt : state[key]>value.$gt);
    return state[key]===value;
  });
  const model = {
    findOneAndUpdate(filter,update){
      let found=null;
      if(matches(filter)){Object.assign(state,update.$set);state.attempts+=update.$inc?.attempts||0;found={...state};}
      return {select:async()=>found};
    },
    async updateOne(filter,update){if(matches(filter)){Object.assign(state,update.$set);if(update.$unset)for(const key of Object.keys(update.$unset))delete state[key];}},
  };
  const api = new Function('Pickup','User','PickupOtp','ApiError','normalizeOtpPhone','requireOtpProvider','sendPickupCode','checkPickupCode', source+';return {assertOtpPickup,verifyPickupOtp};')({}, {findById:async()=>({phonenumber:'9876543210'})},model,ApiError,normalizeOtpPhone,()=>{},()=>{},async(sid,code)=>{checks++;return code==='123456';});
  return {...api,state,get checks(){return checks;}};
}
test('normalizes Indian phone formats and rejects missing or malformed numbers',()=>{
  for(const value of ['9876543210','919876543210','+91 98765 43210']) assert.equal(normalizeOtpPhone(value),'+919876543210');
  for(const value of ['',null,'abc','123']) assert.throws(()=>normalizeOtpPhone(value));
});
test('only assigned agents with saved weight and in-progress pickups qualify',()=>{
  const h=harness();
  assert.throws(()=>h.assertOtpPickup(pickup,{_id:'other'}),e=>e.statusCode===403);
  for(const status of ['completed','cancelled','scheduled','assigned']) assert.throws(()=>h.assertOtpPickup({...pickup,status},{_id:'a1'}));
  assert.throws(()=>h.assertOtpPickup({...pickup,weight:0},{_id:'a1'}));
});
test('missing, expired, exhausted, changed-weight and wrong-agent challenges fail closed',async()=>{
  await assert.rejects(harness().verifyPickupOtp(pickup,{_id:'a1'},undefined));
  for(const change of [{expiresAt:new Date(0)},{attempts:5},{weight:13},{operatorId:'other'},{phone:'+919999999999'},{state:'used'}]){
    const h=harness(change);
    await assert.rejects(h.verifyPickupOtp(pickup,{_id:'a1'},'123456'));
    assert.equal(h.checks,0);
  }
});
test('incorrect codes count attempts; successful codes are consumed and cannot be replayed',async()=>{
  const h=harness();
  await assert.rejects(h.verifyPickupOtp(pickup,{_id:'a1'},'000000'),/Incorrect OTP/);
  assert.equal(h.state.attempts,1);assert.equal(h.state.state,'pending');
  await h.verifyPickupOtp(pickup,{_id:'a1'},'123456');
  assert.equal(h.state.state,'used');assert.equal(h.state.verificationSid,undefined);
  await assert.rejects(h.verifyPickupOtp(pickup,{_id:'a1'},'123456'));
});
test('concurrent verification attempts cannot both consume a challenge',async()=>{
  const h=harness();
  const results=await Promise.allSettled([h.verifyPickupOtp(pickup,{_id:'a1'},'123456'),h.verifyPickupOtp(pickup,{_id:'a1'},'123456')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(h.checks,1);
});
test('provider uses verification SID and does not expose OTPs in send responses',async t=>{
  const previous = {...process.env};
  const oldFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=oldFetch;for(const key of ['PICKUP_OTP_MODE','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PICKUP_VERIFY_SERVICE_SID']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}});
  process.env.PICKUP_OTP_MODE='twilio';
  delete process.env.TWILIO_PICKUP_VERIFY_SERVICE_SID;
  await assert.rejects(sendPickupCode('+919876543210'),e=>e.statusCode===503);
  process.env.TWILIO_ACCOUNT_SID='test';process.env.TWILIO_AUTH_TOKEN='test';process.env.TWILIO_PICKUP_VERIFY_SERVICE_SID='test';
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,body:options.body});return {ok:true,json:async()=>({sid:'VEtest',status:url.endsWith('Verifications')?'pending':'approved'})};};
  assert.equal(await sendPickupCode('+919876543210'),'VEtest');
  assert.equal(await checkPickupCode('VEtest','123456'),true);
  assert.equal(calls[1].body.get('VerificationSid'),'VEtest');
  assert.equal(calls[1].body.get('Code'),'123456');
});

const pickupSource=await readFile(new URL('../src/services/pickup.service.js',import.meta.url),'utf8');

test('default pickup provider reuses login generation with isolated, expiring single-use codes', async t => {
  const oldMode=process.env.PICKUP_OTP_MODE, oldLog=console.log, oldNow=Date.now;
  const messages=[];
  t.after(()=>{console.log=oldLog;Date.now=oldNow;if(oldMode===undefined)delete process.env.PICKUP_OTP_MODE;else process.env.PICKUP_OTP_MODE=oldMode;});
  delete process.env.PICKUP_OTP_MODE;
  console.log=message=>messages.push(message);
  const loginCode=await generateOTPService('9876543210');
  const sid=await sendPickupCode('+919876543210');
  const code=messages.at(-1).match(/: (\d{6}) /)[1];
  await assert.rejects(verifyOTPService('9876543210',loginCode,{purpose:'pickup',reference:'9876543210'}));
  assert.equal(await verifyOTPService('9876543210',String(loginCode)),true);
  assert.equal(await checkPickupCode(sid,code),true);
  await assert.rejects(checkPickupCode(sid,code));
  const expiredSid=await sendPickupCode('+919876543210');
  const expiredCode=messages.at(-1).match(/: (\d{6}) /)[1];
  Date.now=()=>oldNow()+300001;
  await assert.rejects(checkPickupCode(expiredSid,expiredCode),/expired/);
});
test('console mode logs a working single-use code only in development',async t=>{
  const oldMode=process.env.PICKUP_OTP_MODE, oldEnvironment=process.env.NODE_ENV;
  const originalLog=console.log;
  const messages=[];
  t.after(()=>{
    console.log=originalLog;
    if(oldMode===undefined)delete process.env.PICKUP_OTP_MODE;else process.env.PICKUP_OTP_MODE=oldMode;
    if(oldEnvironment===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldEnvironment;
  });
  console.log=message=>messages.push(message);
  process.env.PICKUP_OTP_MODE='console';process.env.NODE_ENV='development';
  const sid=await sendPickupCode('+919876543210');
  const code=messages[0].match(/: (\d{6}) /)[1];
  assert.equal(messages[0].includes('9876543210'),false);
  assert.equal(await checkPickupCode(sid,'000000'),false);
  assert.equal(await checkPickupCode(sid,code),true);
  await assert.rejects(checkPickupCode(sid,code));
  process.env.NODE_ENV='production';
  await assert.rejects(sendPickupCode('+919876543210'),e=>e.statusCode===503);
  assert.equal(messages.length,1);
});
test('sending only returns masked metadata and applies server resend limits',async()=>{
  let sent=0, blocked=false, filter;
  const updates=[];
  const model={
    findOneAndUpdate:async(query)=>{filter=query;if(blocked)throw Object.assign(new Error('duplicate'),{code:11000});return {sends:0};},
    updateOne:async(query,update)=>{updates.push(update);},
  };
  const send=new Function('Pickup','User','PickupOtp','ApiError','normalizeOtpPhone','requireOtpProvider','sendPickupCode','checkPickupCode',source+';return requestPickupOtp;')(
    {findById:()=>({select:async()=>pickup})}, {findById:async()=>({phonenumber:'9876543210'})}, model,ApiError,normalizeOtpPhone,()=>{},async()=>{sent++;return 'VEtest';},()=>{}
  );
  const response=await send('p1',{_id:'a1'});
  assert.deepEqual(response,{maskedPhone:'••••••3210',expiresInSeconds:300,resendAfterSeconds:60,deliveryMode:'console'});
  assert.equal(updates[0].$set.state,'pending');
  assert.equal(filter.$and[1].$or[0].sends.$lt,5);
  blocked=true;
  await assert.rejects(send('p1',{_id:'a1'}),e=>e.statusCode===429);
  assert.equal(sent,1);
});
test('normal updates cannot bypass OTP by setting completed or using Mongo operators',async()=>{
  const body=pickupSource.slice(pickupSource.indexOf('export const updatePickup ='),pickupSource.indexOf('export const cancelPickup =')).replace('export const','const');
  const update=new Function('ApiError',body+';return updatePickup;')(ApiError);
  await assert.rejects(update('p1',{status:'completed'}),e=>e.statusCode===403);
  await assert.rejects(update('p1',{$set:{status:'completed'}}),e=>e.statusCode===400);
});
test('recurring completion skips OTP but enforces agent, status and weight; request data cannot bypass regular OTP', async()=>{
  const body=pickupSource.slice(pickupSource.indexOf('export const completePickup ='),pickupSource.indexOf('const completeVerifiedPickup =')).replace('export const','const');
  let checks=0, billed=0, released=0;
  let row={...pickup,recurringContractId:'contract1'};
  const model={findById:async()=>row,findOneAndUpdate:async()=>row,updateOne:async()=>{released++;}};
  const complete=new Function('Pickup','assertOtpPickup','randomUUID','verifyPickupOtp','completeVerifiedPickup','ApiError',body+';return completePickup;')(model,harness().assertOtpPickup,()=> 'lock',async()=>{checks++;throw new ApiError(400,'OTP required');},async()=>{billed++;return 'done';},ApiError);
  assert.equal(await complete('p1',{}, {_id:'a1'}),'done');
  assert.equal(checks,0); assert.equal(billed,1); assert.equal(released,1);
  await assert.rejects(complete('p1',{}, {_id:'other'}), e=>e.statusCode===403);
  row={...row,weight:0}; await assert.rejects(complete('p1',{}, {_id:'a1'}));
  row={...row,weight:12,status:'completed'}; await assert.rejects(complete('p1',{}, {_id:'a1'}));
  row={...pickup};
  await assert.rejects(complete('p1',{recurringContractId:'fake'}, {_id:'a1'}),/OTP required/);
  assert.equal(checks,1); assert.equal(billed,1); assert.equal(released,2);
});

test('completion cannot call billing on failed verification and always releases its lock',async()=>{
  const body=pickupSource.slice(pickupSource.indexOf('export const completePickup ='),pickupSource.indexOf('const completeVerifiedPickup =')).replace('export const','const');
  let billed=0,released=0;
  const model={findById:async()=>pickup,findOneAndUpdate:async()=>pickup,updateOne:async()=>{released++;}};
  const create=verify=>new Function('Pickup','assertOtpPickup','randomUUID','verifyPickupOtp','completeVerifiedPickup','ApiError',body+';return completePickup;')(model,harness().assertOtpPickup,()=> 'lock',verify,async()=>{billed++;return 'done';},ApiError);
  await assert.rejects(create(async()=>{throw new ApiError(400,'Incorrect OTP');})('p1',{otp:'000000'},{_id:'a1'}));
  assert.equal(billed,0);assert.equal(released,1);
  assert.equal(await create(async()=>{})('p1',{otp:'123456'},{_id:'a1'}),'done');
  assert.equal(billed,1);assert.equal(released,2);
});
