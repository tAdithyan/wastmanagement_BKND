import { Router } from "express";
import { getClientPortalDashboard } from "../controllers/clientPortal.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
const router = Router();
router.get("/dashboard", protect, getClientPortalDashboard);
export default router;
