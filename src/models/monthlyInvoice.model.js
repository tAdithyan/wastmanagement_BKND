import mongoose from "mongoose";

const monthlyInvoiceSchema = new mongoose.Schema({
  recurringContractId: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringPickup", required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  billingMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
  pickupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pickup" }],
  totalWeight: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["issued", "paid", "overdue", "cancelled"], default: "issued", index: true },
  issuedAt: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  paidAt: { type: Date, default: null },
  paymentMethod: { type: String, enum: ["wallet", "manual", "razorpay", null], default: null },
  razorpayOrderId: { type: String, default: null, index: true },
  razorpayPaymentId: { type: String, default: null },
}, { timestamps: true });

monthlyInvoiceSchema.index({ recurringContractId: 1, billingMonth: 1 }, { unique: true });
export default mongoose.models.MonthlyInvoice || mongoose.model("MonthlyInvoice", monthlyInvoiceSchema);
