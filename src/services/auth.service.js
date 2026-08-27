const otpStore = new Map();
export const generateOTPService = async (mobile) => {
  const otp = Math.floor(100000 + Math.random() * 900000);

  otpStore.set(mobile, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  console.log(`DEV OTP for ${mobile}: ${otp}`);

  return otp;
};


export const verifyOTPService = async (mobile, otp) => {
  const storedOTP = otpStore.get(mobile);

  if (!storedOTP) {
    throw new Error("OTP not found or expired");
  }

  if (Date.now() > storedOTP.expiresAt) {
    otpStore.delete(mobile);
    throw new Error("OTP expired");
  }

  if (String(storedOTP.otp) !== String(otp)) {
    throw new Error("Invalid OTP");
  }

  otpStore.delete(mobile);

  return true;
};