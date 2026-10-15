import mongoose from 'mongoose';

const serviceAreaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['radius', 'polygon', 'district', 'pincode'], required: true },
  districtCode: { type: Number, index: true },
  center: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
  radiusMeters: { type: Number, min: 1 },
  polygon: { type: [[Number]], default: undefined }, // [longitude, latitude] pairs
  pincodes: { type: [String], default: [] },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export default mongoose.models.ServiceArea || mongoose.model('ServiceArea', serviceAreaSchema);
