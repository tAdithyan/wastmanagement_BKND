// file: src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';
import User from '../models/user.model.js';
import { admin } from "../config/firebaseAdmin.js";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Verify JWT token sent in Authorization header.
 * Attaches verified user document to req.user.
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or malformed Authorization header');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.id || decoded.purpose) throw new ApiError(401, 'Complete registration before signing in');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) throw new ApiError(401, 'User no longer exists');
    req.user = user;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired – please login again'
      : err.message || 'Authentication failed';
    next(new ApiError(401, message));
  }
};

/**
 * Helper to issue a JWT for a given user id.
 */
export const signToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

export const signRegistrationToken = (mobile) =>
  jwt.sign({ mobile, purpose: 'registration' }, JWT_SECRET, { expiresIn: '30m' });

export const requireRegistration = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new Error('Phone verification required');
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    if (decoded.purpose !== 'registration' || typeof decoded.mobile !== 'string') {
      throw new Error('Phone verification required');
    }
    req.registrationMobile = decoded.mobile;
    next();
  } catch {
    next(new ApiError(401, 'Phone verification expired or invalid. Please verify your number again.'));
  }
};

// Only read-only location lookups accept a pending registration credential.
export const protectLocation = (req, res, next) => {
  try {
    const decoded = jwt.verify((req.headers.authorization || '').slice(7), JWT_SECRET);
    if (decoded.purpose === 'registration') return requireRegistration(req, res, next);
  } catch { /* Normal authentication reports the error. */ }
  return protect(req, res, next);
};





const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);

    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default authMiddleware;
