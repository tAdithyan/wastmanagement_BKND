import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['radius', 'polygon', 'district', 'pincode'], required: true },
  districtCode: { type: Number, index: true },
  center: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
  radiusMeters: { type: Number, min: 100, max: 100000 },
  polygon: { type: [[Number]], default: undefined }, // [longitude, latitude] pairs
  pincodes: { type: [String], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

serviceAreaSchema.index({ center: '2dsphere' }, { name: 'service_area_center_2dsphere', sparse: true });

export default mongoose.models.ServiceArea || mongoose.model('ServiceArea', serviceAreaSchema);
