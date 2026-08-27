import mongoose from "mongoose";
import Permission from "../models/permission.model.js";
import { DEFAULT_PERMISSIONS } from "../constants/permissions.js";
import ApiError from "../utils/apiError.js";

// Seed hardcoded permissions into MongoDB
export const seedDefaultPermissions = async () => {
  for (const perm of DEFAULT_PERMISSIONS) {
    await Permission.updateOne(
      { permissionId: perm.permissionId },
      { $set: perm },
      { upsert: true }
    );
  }
};

// GET all permissions
export const getAllPermissionsService = async () => {
  const permissions = await Permission.find({}).sort({ module: 1, name: 1 });
  return permissions.length > 0 ? permissions : DEFAULT_PERMISSIONS;
};

// GET permission by permissionId code (e.g. PERM_USER_READ) or ObjectId
export const getPermissionByIdService = async (id) => {
  const searchKey = id.trim().toUpperCase();

  let permission = DEFAULT_PERMISSIONS.find(
    (p) => p.permissionId.toUpperCase() === searchKey
  );

  if (permission) {
    return permission;
  }

  if (mongoose.Types.ObjectId.isValid(id)) {
    permission = await Permission.findById(id);
  } else {
    permission = await Permission.findOne({ permissionId: searchKey });
  }

  if (!permission) {
    throw new ApiError(404, `Permission '${id}' not found`);
  }

  return permission;
};
