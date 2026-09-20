import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  roleId: { type: String, required: true, unique: true, enum: ['ROL_2', 'ROL_3', 'ROL_4'] },
  sections: { type: [String], default: [] },
}, { timestamps: true });
export default mongoose.model('SidebarAccess', schema);
