import { Router } from "express";
import {
  getAllPermissions,
  getPermissionById,
} from "../controllers/permission.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Read-only reference for hardcoded system permissions
 */

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Retrieve list of all hardcoded system permissions
 *     tags: [Permissions]
 *     responses:
 *       200:
 *         description: Hardcoded system permissions list
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
 *                   example: Hardcoded system permissions fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Permission'
 */
router.get("/permissions", getAllPermissions);

/**
 * @swagger
 * /permissions/{id}:
 *   get:
 *     summary: Get a specific permission by permissionId (e.g. PERM_USER_READ) or ObjectId
 *     tags: [Permissions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: PERM_USER_READ
 *     responses:
 *       200:
 *         description: Permission details
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
 *                   example: Permission fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/Permission'
 *       404:
 *         description: Permission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get("/permissions/:id", getPermissionById);

export default router;
