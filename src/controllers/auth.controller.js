// file: src/controllers/auth.controller.js
// import User from "../models/user.model.js";
// import { signToken } from "../middlewares/auth.middleware.js";
// import ApiError from "../utils/apiError.js";
// import ApiResponse from "../utils/apiResponse.js";

/**
 * Simple login that accepts a userId (or email/phonenumber) and returns a JWT.
 * In a real app you would verify credentials (password, OTP, etc.). Here we just
 * look up the user and issue a token.
 */
// export const login = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       throw new ApiError(401, 'Missing or malformed Authorization header');
//     }
//     const oldToken = authHeader.split(' ')[1];

//     const { phonenumber } = req.body;
//     if (!phonenumber) {
//       return next(new ApiError(400, "phonenumber is required"));
//     }

//     let user = await User.findOne({ phonenumber }).select("-password");

//     if (!user) {
//       // Create user using dummy data
//       const randomId = Math.floor(1000 + Math.random() * 9000);
//       user = await User.create({
//         name: `Guest User ${randomId}`,
//         phonenumber,
//         role: "ROL_5", // Standard Public / Citizen User
//         userId: `USR-2026-${randomId}`,
//         is_active: true,
//       });
//     }

//     const token = signToken(user.id);
//     return res
//       .status(200)
//       .json(new ApiResponse(200, { token, user }, "Login successful"));
//   } catch (err) {
//     next(err);
//   }
// };



import { admin } from "../config/firebaseAdmin.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { signToken } from "../middlewares/auth.middleware.js";
import Role from "../models/role.model.js"
import {generateOTPService,verifyOTPService} from "../services/auth.service.js"







export const sendOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    const otp = await generateOTPService(mobile);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      devOtp: otp,
    });

  } catch (error) {
    console.error(error);
    next(error);
  }
};


export const verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and OTP are required",
      });
    }

    await verifyOTPService(mobile, otp);

    // Find existing user
    let user = await User.findOne({ phonenumber: mobile });

    // Create user if not exists
    let isNewUser = false;
    if (!user) {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      user = await User.create({
        name: `Guest User ${randomId}`,
        phonenumber: mobile,
        role: "ROL_5",
        userId: `USR-2026-${randomId}`,
        is_active: true,
        profileCompleted: false,
      });
      isNewUser = true;
    }

    const token = signToken(user.id);

    const role = await Role.findOne({
      roleId: user.role,
    })
      .populate("permissions")
      .select("permissions");

    if (!role) {
      return next(
        new ApiError(
          500,
          "User role configuration not found"
        )
      );
    }

    
    const permissions = role.permissions
      .filter((permission) => permission.is_active)
      .map((permission) => permission.permissionId);
  
      return res.status(200).json(
      new ApiResponse(
        200,
        {
          token,
          user: {
            ...user.toObject(),
            permissions,
            requiresProfileSetup:
              isNewUser ||
              /^Guest User\s/i.test(user.name),
          },
        },
        "Login successful"
      )
    );

  } catch (error) {
    console.error("Verify OTP Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
