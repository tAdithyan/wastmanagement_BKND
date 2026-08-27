import ApiResponse from "../utils/apiResponse.js";
import {
  getAllPermissionsService,
  getPermissionByIdService,
} from "../services/permission.service.js";

export const getAllPermissions = async (req, res, next) => {
  try {
    const permissions = await getAllPermissionsService();
    return res
      .status(200)
      .json(new ApiResponse(200, permissions, "Hardcoded system permissions fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const getPermissionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const permission = await getPermissionByIdService(id);
    return res
      .status(200)
      .json(new ApiResponse(200, permission, "Permission fetched successfully"));
  } catch (error) {
    next(error);
  }
};
