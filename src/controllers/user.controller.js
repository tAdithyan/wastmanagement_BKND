import ApiResponse from "../utils/apiResponse.js";
import {
  getAllUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  deleteUserService,
  findUserByPhonenumberService,
} from "../services/user.service.js";
import User from "../models/user.model.js";

export const getUserByPhonenumber = async (req, res, next) => {
  try {
    const { phonenumber } = req.query;
    const user = await findUserByPhonenumberService(phonenumber);
    return res
      .status(200)
      .json(new ApiResponse(200, user, "User fetched successfully by phone number"));
  } catch (error) {
    next(error);
  }
};


export const getAllUsers = async (req, res, next) => {
  try {
    const { search, role } = req.query;
    const users = await getAllUsersService({ search, role });
    return res
      .status(200)
      .json(new ApiResponse(200, users, "Users fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateMyAccount = async (req, res, next) => {
  try {
    const allowedFields = ["name", "email", "whatsappnumber", "address", "pincode", "houseNo", "wardNo"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
    if (!updates.name?.trim()) delete updates.name;
    if (typeof updates.email === "string") updates.email = updates.email.trim().toLowerCase();
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    return res.json(new ApiResponse(200, user, "Account updated successfully"));
  } catch (error) { next(error); }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await getUserByIdService(id);
    return res
      .status(200)
      .json(new ApiResponse(200, user, "User fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const newUser = await createUserService(req.body);
    return res
      .status(201)
      .json(new ApiResponse(201, newUser, "User created successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedUser = await updateUserService(id, req.body);
    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "User updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedUser = await deleteUserService(id);
    return res
      .status(200)
      .json(new ApiResponse(200, deletedUser, "User deleted successfully"));
  } catch (error) {
    next(error);
  }
};
