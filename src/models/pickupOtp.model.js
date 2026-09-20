import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup' },
  operatorId: mongoose.Schema.Types.ObjectId,
  customerId: mongoose.Schema.Types.ObjectId,
  phone: String,
  weight: Number,
  verificationSid: { type: String, select: false },
  state: { type: String, enum: ['sending', 'pending', 'verifying', 'used', 'failed'] },
  attempts: { type: Number, default: 0 },
  sends: { type: Number, default: 0 },
  windowStartedAt: Date,
  lastSentAt: Date,
  expiresAt: Date,
}, { timestamps: true });
export default mongoose.model('PickupOtp', schema);
