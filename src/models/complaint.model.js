import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ["submitted", "in_review", "resolved"], default: "submitted", index: true },
  adminResponse: { type: String, default: "", trim: true, maxlength: 3000 },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema);
export default Complaint;
