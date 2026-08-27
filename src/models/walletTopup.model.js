import mongoose from "mongoose";

const walletTopupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 1, max: 100000 },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["created", "verified", "paid", "failed"], default: "created", index: true },
  razorpayOrderId: { type: String, required: true, unique: true, index: true },
  razorpayPaymentId: { type: String, default: null, unique: true, sparse: true, index: true },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.WalletTopup || mongoose.model("WalletTopup", walletTopupSchema);
