import { Router } from "express";
import { getHealthStatus } from "../controllers/health.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: API health and system monitoring endpoint
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Retrieve service health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy and operational
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
 *                   example: Service is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: UP
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       example: 124.52
 */
router.get("/health", getHealthStatus);

export default router;
