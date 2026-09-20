import { randomInt, createHash, timingSafeEqual } from 'node:crypto';

const otpStore = new Map();
const keyFor = (mobile, { purpose = 'login', reference = '' } = {}) => JSON.stringify([purpose, purpose === 'login' ? mobile : reference]);
const digest = (key, otp) => createHash('sha256').update(`${key}:${otp}`).digest();

// Login and pickup codes share the implementation, but not the same namespace.
export const generateOTPService = async (mobile, options = {}) => {
  for (const [key, entry] of otpStore) if (entry.expiresAt <= Date.now()) otpStore.delete(key);
  const key = keyFor(mobile, options);
  const otp = randomInt(100000, 1000000);
  otpStore.set(key, { hash: digest(key, otp), expiresAt: Date.now() + 300000, attempts: 0 });
  if (options.purpose === 'pickup') console.log(`[Pickup OTP] Customer ending ${String(mobile).slice(-4)}: ${otp} (expires in 5 minutes; no SMS sent)`);
  else console.log(`DEV OTP for ${mobile}: ${otp}`);
  return otp;
};

export const verifyOTPService = async (mobile, otp, options = {}) => {
  const key = keyFor(mobile, options);
  const stored = otpStore.get(key);
  if (!stored) throw new Error('OTP not found or expired');
  if (Date.now() >= stored.expiresAt) {
    otpStore.delete(key);
    throw new Error('OTP expired');
  }
  if (stored.attempts >= 5) throw new Error('OTP attempts exhausted. Request another OTP.');
  stored.attempts += 1;
  if (!timingSafeEqual(stored.hash, digest(key, otp))) throw new Error('Invalid OTP');
  otpStore.delete(key);
  return true;
};
