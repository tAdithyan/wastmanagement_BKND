import mongoose from "mongoose";

const districtSchema = new mongoose.Schema(
  {
    districtCode: { type: Number, required: true, unique: true },
    districtName: { type: String, required: true },
    normalizedDistrictName: { type: String, trim: true, lowercase: true },
    stateName: { type: String, trim: true },
    stateCode: { type: String, trim: true, uppercase: true },
    isServiceable: { type: Boolean, default: false },
    boundary: { type: mongoose.Schema.Types.Mixed, default: undefined },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

districtSchema.index({ boundary: '2dsphere' }, { name: 'district_boundary_2dsphere', sparse: true });
districtSchema.index({ normalizedDistrictName: 1, stateCode: 1 }, { name: 'district_normalized_name_state', unique: true, partialFilterExpression: { normalizedDistrictName: { $type: 'string' } } });

const District = mongoose.model("District", districtSchema);

export default District;
