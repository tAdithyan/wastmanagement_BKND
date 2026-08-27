import crypto from "node:crypto";
import mongoose from "mongoose";

const binCounterSchema = new mongoose.Schema({ name: { type: String, unique: true }, sequence: { type: Number, default: 0 } });
const BinCounter = mongoose.models.BinCounter || mongoose.model("BinCounter", binCounterSchema);

const binSchema = new mongoose.Schema({
  binId: { type: String, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  coordinates: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  status: { type: String,    enum: [
        "Pending",
        "Collected",
    ], default: "Pending", index: true },
  qrToken: { type: String, unique: true, index: true, default: () => crypto.randomBytes(24).toString("hex") },
  lastScannedAt: { type: Date, default: null },
  statusUpdatedAt: { type: Date, default: Date.now },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  collectedShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null, index: true },
  collectedAt: { type: Date, default: null },
}, { timestamps: true });

binSchema.pre("save", async function () { if (!this.binId) { const counter = await BinCounter.findOneAndUpdate({ name: "binId" }, { $inc: { sequence: 1 } }, { new: true, upsert: true }); this.binId = `BIN-${String(counter.sequence).padStart(4, "0")}`; } });
binSchema.set("toJSON", { transform: (_doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; } });
export default mongoose.models.Bin || mongoose.model("Bin", binSchema);
