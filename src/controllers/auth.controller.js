// file: src/controllers/auth.controller.js
// import User from "../models/user.model.js";
// import { signToken, signRegistrationToken } from "../middlewares/auth.middleware.js";
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
import { signToken, signRegistrationToken } from "../middlewares/auth.middleware.js";
import District from "../models/District.js";
import PRI from "../models/PRI.js";
import URB from "../models/Urban.js";
import { createHash } from "node:crypto";
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


const needsRegistration = (user) =>
  ['ROL_5', 'User'].includes(user.role) && !user.profileCompleted && /^Guest User\s/i.test(user.name);

async function permissionsFor(roleId) {
  const role = await Role.findOne({ roleId }).populate("permissions").select("permissions");
  if (!role) throw new ApiError(500, "User role configuration not found");
  return role.permissions.filter(p => p.is_active).map(p => p.permissionId);
}

async function loginResponse(res, user) {
  if (user.is_active === false) throw new ApiError(403, "Your account is inactive");
  const permissions = await permissionsFor(user.role);
  return res.status(200).json(new ApiResponse(200, {
    token: signToken(user.id),
    user: { ...user.toObject(), permissions, requiresProfileSetup: false },
  }, "Login successful"));
}

export const verifyOTP = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) throw new ApiError(400, "Mobile number and OTP are required");
    await verifyOTPService(mobile, otp);
    const user = await User.findOne({ phonenumber: mobile });
    if (user?.is_active === false) throw new ApiError(403, "Your account is inactive");
    if (!user || needsRegistration(user)) {
      return res.status(200).json(new ApiResponse(200, {
        requiresProfileSetup: true,
        registrationToken: signRegistrationToken(mobile),
        mobile,
      }, "Phone verified. Complete your profile to create your account."));
    }
    return await loginResponse(res, user);
  } catch (error) {
    next(error.statusCode ? error : new ApiError(400, error.message));
  }
};

export const completeRegistration = async (req, res, next) => {
  try {
    const profile = {};
    for (const field of ['name', 'email', 'whatsappnumber', 'district', 'localbodytype', 'localbody', 'wardNo', 'houseNo', 'address', 'pincode']) {
      profile[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : '';
    }
    if (['name', 'district', 'localbodytype', 'localbody', 'wardNo', 'address', 'pincode'].some(field => !profile[field])) {
      throw new ApiError(400, "Complete your name, district, local body, ward, address and pincode.");
    }
    if (!/^[a-f\d]{24}$/i.test(profile.district) ||
        !['panjayath', 'municipalaty'].includes(profile.localbodytype) ||
        !/^[1-9]\d{5}$/.test(profile.pincode)) {
      throw new ApiError(400, "Select a valid location and enter a valid six-digit pincode.");
    }
    const district = await District.findById(profile.district);
    const LocalBody = profile.localbodytype === 'panjayath' ? PRI : URB;
    if (!district || !await LocalBody.exists({ districtCode: district.districtCode, localbodyname: profile.localbody })) {
      throw new ApiError(400, "Select a valid local body in your district.");
    }
    const mobile = req.registrationMobile;
    await permissionsFor("ROL_5");
    let user = await User.findOne({ phonenumber: mobile });
    if (user?.is_active === false) throw new ApiError(403, "Your account is inactive");
    if (user && needsRegistration(user)) {
      // Finish a placeholder left by an older app without changing its identity.
      user = await User.findOneAndUpdate(
        { _id: user._id, profileCompleted: { $ne: true } },
        { $set: { ...profile, profileCompleted: true } },
        { new: true, runValidators: true }
      ) || await User.findOne({ phonenumber: mobile });
    } else if (!user) {
      // Stable unique identity makes simultaneous submits and network retries safe.
      const userId = 'USR-' + createHash('sha256').update(mobile).digest('hex').slice(0, 24);
      try {
        user = await User.findOneAndUpdate(
          { userId },
          { $setOnInsert: { ...profile, phonenumber: mobile, role: 'ROL_5', userId, is_active: true, profileCompleted: true } },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ userId });
        if (!user) throw error;
      }
    }
    return await loginResponse(res, user);
  } catch (error) {
    next(error);
  }
};
