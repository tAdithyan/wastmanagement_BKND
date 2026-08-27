import mongoose from "mongoose";
import crypto from "node:crypto";

const recurringPickupSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  clientAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  qrToken: { type: String, unique: true, index: true, default: () => crypto.randomBytes(24).toString("hex") },
  assignedBin: { type: mongoose.Schema.Types.ObjectId, ref: "Bin", default: null, index: true },
  name: { type: String, required: true, trim: true },
  wasteType: { type: String, required: true, trim: true },
  collectionDays: [{ type: Number, min: 0, max: 6, required: true }],
  preferredTime: { type: String, default: "09:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  ratePerKg: { type: Number, required: true, min: 0.01 },
  pickupLocation: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  address: { type: String, default: "", trim: true },
  notes: { type: String, default: "", trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  isActive: { type: Boolean, default: true, index: true },
  lastGeneratedDate: { type: Date, default: null },
}, { timestamps: true });

recurringPickupSchema.index({ pickupLocation: "2dsphere" });
recurringPickupSchema.pre("validate", function () {
  if (this.pickupLocation && !this.pickupLocation.type) this.pickupLocation.type = "Point";
});
export default mongoose.models.RecurringPickup || mongoose.model("RecurringPickup", recurringPickupSchema);
