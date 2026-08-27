import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    districtCode: { type: Number, required: true, unique: true },
    districtName: { type: String, required: true },
  },
  { timestamps: true }
);

const District = mongoose.model("District", districtSchema);

export default District;
