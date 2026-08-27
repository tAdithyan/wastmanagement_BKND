import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    priId: { type: String, unique: true },
    districtCode: { type: Number, required: false },
    localbodyname: { type: String, required: false },
  },
  { timestamps: true }
);

// Auto-generate priId before saving
districtSchema.pre("save", async function (next) {
  if (!this.priId) {
    const count = await mongoose.model("PRI").countDocuments();
    this.priId = `PRI_${count + 1}`;
  }
  next();
});

const PRI = mongoose.model("PRI", districtSchema);

export default PRI;
