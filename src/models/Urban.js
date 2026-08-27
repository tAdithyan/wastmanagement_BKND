import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    urbId: { type: String, unique: true },
    districtCode: { type: Number, required: false },
    localbodyname: { type: String, required: false },
  },
  { timestamps: true }
);

// Auto-generate priId before saving
districtSchema.pre("save", async function (next) {
  if (!this.urbId) {
    const count = await mongoose.model("URB").countDocuments();
    this.urbId = `URB_${count + 1}`;
  }
  next();
});

const URB = mongoose.model("URB", districtSchema);

export default URB;
