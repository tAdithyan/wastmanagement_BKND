import { Router } from "express";
import {
  getAllRoles,
  getRoleById,
  updateRolePermissions,
} from "../controllers/role.controller.js";
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';


const router = Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: System roles reference (ROL_1 to ROL_5) and permission assignments
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Retrieve list of all constant system roles with populated permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of predefined constant system roles
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
 *                   example: Constant system roles fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 */
router.route('/roles').get(protect, authorize(['PERM_ROLE_READ']), getAllRoles);
/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Retrieve a constant role by roleId (e.g. ROL_1, ROL_2) or name
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role code (ROL_1, ROL_2, ROL_3, ROL_4, ROL_5) or Role Name
 *         example: ROL_1
 *     responses:
 *       200:
 *         description: Role details with populated permissions
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
 *                   example: Role fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get("/roles/:id", getRoleById);

/**
 * @swagger
 * /roles/{id}/permissions:
 *   put:
 *     summary: Assign permissions to a role by roleId (e.g. ROL_2) or ObjectId
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role code (ROL_1, ROL_2, ROL_3, ROL_4, ROL_5) or MongoDB ObjectId
 *         example: ROL_2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["PERM_USER_READ", "PERM_USER_CREATE", "PERM_COLLECTION_MANAGE"]
 *                 description: Array of permissionId codes or MongoDB Permission ObjectIds
 *     responses:
 *       200:
 *         description: Role permissions assigned successfully
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
 *                   example: Role permissions assigned successfully
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Invalid request payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       404:
 *         description: Role not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.put("/roles/:id/permissions", updateRolePermissions);

export default router;
