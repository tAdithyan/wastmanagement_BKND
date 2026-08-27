import mongoose from "mongoose";

const wastePriceSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, unique: true, trim: true, index: true },
    pricePerKg: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

wastePriceSchema.set("toJSON", {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.models.WastePrice || mongoose.model("WastePrice", wastePriceSchema);
