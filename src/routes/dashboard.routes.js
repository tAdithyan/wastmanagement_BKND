import { Router } from "express";
import { getWasteAnalysis } from '../controllers/waste-analysis.controller.js';
import { getOperationsDashboard } from "../controllers/dashboard.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();
router.get('/waste-analysis', protect, authorize(['PERM_PICKUP_READ']), getWasteAnalysis);
router.get("/", protect, authorize(["PERM_PICKUP_READ"]), getOperationsDashboard);
export default router;
