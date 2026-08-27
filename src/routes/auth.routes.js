// file: src/routes/auth.routes.js
import { Router } from "express";
import { sendOTP,verifyOTP } from "../controllers/auth.controller.js";

const router = Router();


/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login using Firebase Phone Authentication
 *     description: |
 *       Verifies the Firebase ID token sent in the Authorization header.
 *       If the Firebase user does not exist in MongoDB, a new user is created.
 *     tags: [Auth]
 *
 *     security:
 *       - bearerAuth: []
 *
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *
 *       400:
 *         description: Invalid Firebase user or phone number not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Phone number not found in Firebase account
 *
 *       401:
 *         description: Missing, invalid, or expired Firebase ID token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 401
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid or expired Firebase token
 *
 *       403:
 *         description: User account is inactive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 403
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: User account is inactive
 */





/**
 * @swagger
 * /auth/sendOTP:
 *   post:
 *     summary: Send OTP to a mobile number
 *     description: Generates a 6-digit OTP valid for 5 minutes and sends it to the given mobile number. In development, the OTP is also returned in the response.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobile
 *             properties:
 *               mobile:
 *                 type: string
 *                 example: "+919876543210"
 *                 description: Mobile number to send OTP to
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully
 *                 devOtp:
 *                   type: integer
 *                   example: 482910
 *                   description: Development-only — the generated OTP
 *       400:
 *         description: Mobile number is missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Mobile number is required
 */
router.post("/sendOTP", sendOTP);

/**
 * @swagger
 * /auth/VerifyOTP:
 *   post:
 *     summary: Verify OTP and login
 *     description: Validates the OTP for the given mobile number. On success, returns a JWT token and user details with permissions. Creates a new user if one does not already exist.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobile
 *               - otp
 *             properties:
 *               mobile:
 *                 type: string
 *                 example: "+919876543210"
 *               otp:
 *                 type: string
 *                 example: "482910"
 *     responses:
 *       200:
 *         description: OTP verified, login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       allOf:
 *                         - $ref: '#/components/schemas/User'
 *                         - type: object
 *                           properties:
 *                             permissions:
 *                               type: array
 *                               items:
 *                                 type: string
 *                               example: ["PERM_USER_READ", "PERM_BILLING_MANAGE"]
 *       400:
 *         description: Missing fields, invalid OTP, or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid OTP
 */
router.post("/VerifyOTP", verifyOTP);


export default router;
