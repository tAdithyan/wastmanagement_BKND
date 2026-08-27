import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const shiftSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "completed"], default: "active", index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    route: { type: [pointSchema], default: [] },
    lastLocation: { type: pointSchema, default: null },
    collectedBins: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bin" }],
  },
  { timestamps: true }
);

shiftSchema.index({ agentId: 1, status: 1 });
export default mongoose.model("Shift", shiftSchema);
