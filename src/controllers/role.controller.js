import ApiResponse from "../utils/apiResponse.js";
import {
  getAllRolesService,
  getRoleByIdService,
  updateRolePermissionsService,
} from "../services/role.service.js";

export const getAllRoles = async (req, res, next) => {
  try {
    const roles = await getAllRolesService();
    return res
      .status(200)
      .json(new ApiResponse(200, roles, "Constant system roles fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const getRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = await getRoleByIdService(id);
    return res
      .status(200)
      .json(new ApiResponse(200, role, "Role fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateRolePermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const updatedRole = await updateRolePermissionsService(id, permissions);
    return res
      .status(200)
      .json(new ApiResponse(200, updatedRole, "Role permissions assigned successfully"));
  } catch (error) {
    next(error);
  }
};
