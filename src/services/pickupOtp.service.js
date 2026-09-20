import Pickup from "../models/pickup.modal.js";
import User from "../models/user.model.js";
import PickupOtp from "../models/pickupOtp.model.js";
import ApiError from "../utils/apiError.js";
import {
  normalizeOtpPhone,
  requireOtpProvider,
  sendPickupCode,
  checkPickupCode,
} from "./pickupOtpProvider.js";

export function assertOtpPickup(pickup, actor) {
  if (!pickup) throw new ApiError(404, "Pickup not found");
  if (
    !actor?._id ||
    !pickup.operatorId ||
    String(actor._id) !== String(pickup.operatorId)
  )
    throw new ApiError(
      403,
      "Only the assigned agent can verify and complete this pickup.",
    );
  if (pickup.status !== "in_progress")
    throw new ApiError(409, "Only an in-progress pickup can be completed.");
  if (!(pickup.weight > 0))
    throw new ApiError(
      400,
      "Save the collected weight before requesting an OTP.",
    );
}
export async function requestPickupOtp(id, actor) {
  requireOtpProvider();
  const pickup = await Pickup.findById(id).select("+completionLockId");
  assertOtpPickup(pickup, actor);
  if (pickup.completionLockId)
    throw new ApiError(409, "Pickup completion is already being processed.");
  const customer = await User.findById(pickup.customerId);
  const phone = normalizeOtpPhone(customer?.phonenumber);
  const now = new Date();
  // Unique pickup ID plus a conditional write prevents simultaneous resends.
  let challenge;
  try {
    challenge = await PickupOtp.findOneAndUpdate(
      {
        _id: id,
        state: { $nin: ["sending", "verifying"] },
        $and: [
          {
            $or: [
              { lastSentAt: { $lte: new Date(now - 60000) } },
              { lastSentAt: { $exists: false } },
            ],
          },
          {
            $or: [
              { sends: { $lt: 5 } },
              { windowStartedAt: { $lte: new Date(now - 3600000) } },
              { sends: { $exists: false } },
            ],
          },
        ],
      },
      {
        $set: {
          state: "sending",
          lastSentAt: now,
          operatorId: actor._id,
          customerId: pickup.customerId,
          phone,
          weight: pickup.weight,
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    if (error.code === 11000)
      throw new ApiError(
        429,
        "Please wait before requesting another OTP. You can request up to five per hour.",
      );
    throw error;
  }
  try {
    const sid = await sendPickupCode(phone);
    const freshWindow =
      !challenge.windowStartedAt || now - challenge.windowStartedAt >= 3600000;
    await PickupOtp.updateOne(
      { _id: id, state: "sending", lastSentAt: now },
      {
        $set: {
          verificationSid: sid,
          state: "pending",
          attempts: 0,
          expiresAt: new Date(now.getTime() + 300000),
          windowStartedAt: freshWindow ? now : challenge.windowStartedAt,
          sends: freshWindow ? 1 : challenge.sends + 1,
        },
      },
    );
    return {
      maskedPhone: `••••••${phone.slice(-4)}`,
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
      deliveryMode: process.env.PICKUP_OTP_MODE === 'twilio' ? 'sms' : 'console',
    };
  } catch (error) {
    await PickupOtp.updateOne(
      { _id: id, state: "sending", lastSentAt: now },
      { $set: { state: "failed" } },
    );
    throw error;
  }
}
export async function verifyPickupOtp(pickup, actor, otp) {
  assertOtpPickup(pickup, actor);
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp))
    throw new ApiError(400, "Enter the six-digit OTP sent to the customer.");
  const customer = await User.findById(pickup.customerId);
  const phone = normalizeOtpPhone(customer?.phonenumber);
  const challenge = await PickupOtp.findOneAndUpdate(
    {
      _id: pickup._id,
      operatorId: actor._id,
      customerId: pickup.customerId,
      phone,
      weight: pickup.weight,
      state: "pending",
      attempts: { $lt: 5 },
      expiresAt: { $gt: new Date() },
    },
    { $set: { state: "verifying" }, $inc: { attempts: 1 } },
    { new: true },
  ).select("+verificationSid");
  if (!challenge)
    throw new ApiError(
      400,
      "OTP expired, used, or attempts exhausted. Request another OTP.",
    );
  try {
    if (!(await checkPickupCode(challenge.verificationSid, otp)))
      throw new ApiError(
        400,
        "Incorrect OTP. Check the code with the customer and try again.",
      );
    await PickupOtp.updateOne(
      { _id: pickup._id, state: "verifying" },
      { $set: { state: "used" }, $unset: { verificationSid: 1 } },
    );
  } catch (error) {
    await PickupOtp.updateOne(
      { _id: pickup._id, state: "verifying" },
      { $set: { state: "pending" } },
    );
    throw error;
  }
}
