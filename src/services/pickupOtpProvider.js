import ApiError from '../utils/apiError.js';
import { randomUUID } from 'node:crypto';
import { generateOTPService, verifyOTPService } from './auth.service.js';

function loginOtpEnabled() {
  const mode = process.env.PICKUP_OTP_MODE || 'login';
  if (mode === 'console' && process.env.NODE_ENV !== 'development') throw new ApiError(503, 'Console pickup OTPs are only available in development.');
  if (!['login', 'console', 'twilio'].includes(mode)) throw new ApiError(503, 'Invalid pickup OTP mode.');
  return mode !== 'twilio';
}

export function normalizeOtpPhone(value) {
  let phone = String(value || '').replace(/[\s()-]/g, '');
  if (/^[6-9]\d{9}$/.test(phone)) phone = `+91${phone}`;
  else if (/^91[6-9]\d{9}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new ApiError(400, 'The customer needs a valid phone number in their profile before an OTP can be sent.');
  return phone;
}
export function requireOtpProvider() {
  if (loginOtpEnabled()) return {};
  const { TWILIO_ACCOUNT_SID: account, TWILIO_AUTH_TOKEN: token, TWILIO_PICKUP_VERIFY_SERVICE_SID: service } = process.env;
  if (!account || !token || !service) throw new ApiError(503, 'Pickup SMS verification is not configured. Please contact the administrator.');
  return { account, token, service };
}
async function request(path, fields) {
  const { account, token, service } = requireOtpProvider();
  let response;
  try {
    response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(service)}/${path}`, {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError(503, 'The SMS verification service is unavailable. Please retry.'); }
  if (!response.ok) {
    if (response.status === 429) throw new ApiError(429, 'Too many OTP requests. Please wait before retrying.');
    if (response.status === 404 && path === 'VerificationCheck') throw new ApiError(400, 'OTP expired or already used. Request another OTP.');
    throw new ApiError(502, 'The SMS provider could not process this request. Please retry or contact the administrator.');
  }
  return response.json();
}
export async function sendPickupCode(phone) {
  if (loginOtpEnabled()) {
    const sid = `pickup:${randomUUID()}`;
    await generateOTPService(phone, { purpose: 'pickup', reference: sid });
    return sid;
  }
  const result = await request('Verifications', { To: phone, Channel: 'sms' });
  if (result.status !== 'pending' || !result.sid) throw new ApiError(502, 'The SMS provider did not accept the OTP request.');
  return result.sid;
}
export async function checkPickupCode(verificationSid, code) {
  if (loginOtpEnabled()) {
    try { return await verifyOTPService(null, code, { purpose: 'pickup', reference: verificationSid }); }
    catch (error) {
      if (error.message === 'Invalid OTP') return false;
      throw new ApiError(400, `${error.message}. Request another pickup OTP.`);
    }
  }
  const result = await request('VerificationCheck', { VerificationSid: verificationSid, Code: code });
  return result.status === 'approved' && result.sid === verificationSid;
}
