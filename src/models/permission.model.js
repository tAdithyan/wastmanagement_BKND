import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    permissionId: {
      type: String,
      required: [true, "permissionId is required"],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Permission name is required"],
      trim: true,
    },
    module: {
      type: String,
      required: [true, "Module name is required"],
      trim: true,
    },
    action: {
      type: String,
      enum: ["create", "read", "update", "delete", "manage", "export"],
      default: "read",
    },
    description: {
      type: String,
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
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

const Permission = mongoose.model("Permission", permissionSchema);

export default Permission;
