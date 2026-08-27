import mongoose from "mongoose";
import { ROLE_IDS, ROLE_NAMES } from "../constants/roles.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: false },
    phonenumber: { type: String, required: true },
    whatsappnumber: { type: String, required: false },
    district: { type: mongoose.Schema.Types.ObjectId, ref: "District", required: false },
    localbodytype: { type: String, enum: ["panjayath", "municipalaty"], required: false },
    localbody: { type: String, required: false },
    wardNo: { type: String, required: false },
    houseNo: { type: String, required: false },
    address: { type: String, required: false },
    profileCompleted: { type: Boolean, required: false, default: false },
    is_active: { type: Boolean, required: false, default: true },
    userId: { type: String, unique: true, sparse: true },
    wallet: { type: Number, required: false, default: 0, min: 0 },
    walletTopupIds: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
    cordinates: {
      latitude: { type: Number, required: false },
      longitude: { type: Number, required: false },
    },
    role: {
      type: String,
      enum: [...ROLE_IDS, ...ROLE_NAMES],
      default: "ROL_5",
      required: false,
    },
    pincode: { type: String, required: false },
    qrcode_url: { type: String, required: false },
    vehicleno: { type: String, required: false },
    adharno: { type: String, required: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const User = mongoose.model("User", userSchema);

export default User;
