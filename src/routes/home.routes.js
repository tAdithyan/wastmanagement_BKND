import { Router } from "express";

import { getCustomerHomepageData } from "../controllers/home.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Home
 *   description: Customer homepage summary APIs
 */

/**
 * @swagger
 * /home/customer:
 *   get:
 *     summary: Get the signed-in customer's homepage data
 *     description: Returns billing, wallet, pickup totals, collected weight, and the five most recent collections for the authenticated customer.
 *     tags: [Home]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Homepage data fetched successfully
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
 *                   example: Homepage data fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBilled:
 *                       type: number
 *                       example: 750
 *                     totalPickups:
 *                       type: integer
 *                       example: 3
 *                     walletAmount:
 *                       type: number
 *                       example: 150
 *                     avgpickups:
 *                       type: number
 *                       description: Total collected pickup weight
 *                       example: 42.5
 *                     recentCollections:
 *                       type: array
 *                       maxItems: 5
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: 6a79dcf8e8c407eefea8f79b
 *                           customerId:
 *                             type: string
 *                             example: 6a79dcf8e8c407eefea8f79c
 *                           operatorId:
 *                             type: string
 *                             nullable: true
 *                             example: 6a79dcf8e8c407eefea8f80
 *                           wasteType:
 *                             type: string
 *                             example: Plastic
 *                           weight:
 *                             type: number
 *                             example: 12.5
 *                           amount:
 *                             type: number
 *                             example: 250
 *                           status:
 *                             type: string
 *                             enum: [scheduled, assigned, in_progress, completed, cancelled, failed]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Missing, invalid, or expired authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get("/customer", protect, getCustomerHomepageData);

export default router;
