import mongoose from "mongoose";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

const normalizeRole = (role) => role === "CLIENT_ADMIN" || role === "ROLE_6" ? "ROL_6" : role;

export const getAllUsersService = async (filters = {}) => {
  const query = {};

  // Text search on name, email, or phonenumber
  if (filters.search) {
    const searchRegex = new RegExp(filters.search, "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phonenumber: searchRegex },
    ];
  }

  // Exact match filter for role (handles roleId e.g. ROL_5 or name e.g. User)
  if (filters.role) {
    query.role = filters.role;
  }

  const users = await User.find(query).sort({ createdAt: -1 });
  return users;
};

export const getUserByIdService = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid user ID format: '${id}'`);
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, `User with ID '${id}' not found`);
  }
  return user;
};

export const createUserService = async (userData) => {
  const { name, phonenumber, email, userId } = userData;

  if (!name || !phonenumber) {
    throw new ApiError(400, "Name and phonenumber are required fields");
  }

  if (email) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ApiError(409, "User with this email already exists");
    }
  }

  if (userId) {
    const existingUserId = await User.findOne({ userId });
    if (existingUserId) {
      throw new ApiError(409, "User with this userId already exists");
    }
  }

  const newUser = await User.create({
    ...userData,
    ...(userData.role && { role: normalizeRole(userData.role) }),
    ...(email && { email: email.toLowerCase() }),
  });

  return newUser;
};

export const updateUserService = async (id, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid user ID format: '${id}'`);
  }

  if (updateData.email) {
    const emailCheck = await User.findOne({
      email: updateData.email.toLowerCase(),
      _id: { $ne: id },
    });
    if (emailCheck) {
      throw new ApiError(409, "Email is already in use by another user");
    }
  }

  if (updateData.userId) {
    const userIdCheck = await User.findOne({
      userId: updateData.userId,
      _id: { $ne: id },
    });
    if (userIdCheck) {
      throw new ApiError(409, "userId is already in use by another user");
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      ...updateData,
      ...(updateData.role && { role: normalizeRole(updateData.role) }),
      ...(updateData.email && { email: updateData.email.toLowerCase() }),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedUser) {
    throw new ApiError(404, `User with ID '${id}' not found`);
  }

  return updatedUser;
};

export const deleteUserService = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid user ID format: '${id}'`);
  }

  const deletedUser = await User.findByIdAndDelete(id);
  if (!deletedUser) {
    throw new ApiError(404, `User with ID '${id}' not found`);
  }

  return deletedUser;
};

export const findUserByPhonenumberService = async (phonenumber) => {
  if (!phonenumber) {
    throw new ApiError(400, "Phone number query parameter is required");
  }
  const user = await User.findOne({ phonenumber });
  if (!user) {
    throw new ApiError(404, `User with phone number '${phonenumber}' not found`);
  }
  return user;
};
