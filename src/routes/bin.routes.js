import { Router } from "express";
import { assignBinAgentController, createBinController, getScannedBinController, listBinsController, listMyAssignedBinsController, updateBinController, updateScannedBinLocationController, updateScannedBinStatusController } from "../controllers/bin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();
router.get("/assigned/me", protect, authorize(["PERM_BIN_READ"]), listMyAssignedBinsController);
router.get("/scan/:token", protect, authorize(["PERM_BIN_READ"]), getScannedBinController);
router.patch("/scan/:token/status", protect, authorize(["PERM_BIN_UPDATE"]), updateScannedBinStatusController);
router.patch("/scan/:token/location", protect, authorize(["PERM_BIN_UPDATE"]), updateScannedBinLocationController);
router.get("/", protect, authorize(["PERM_LOCATION_MANAGE", "PERM_BIN_READ"]), listBinsController);
router.post("/", protect, authorize(["PERM_LOCATION_MANAGE"]), createBinController);
router.patch("/:id/agent", protect, authorize(["PERM_LOCATION_MANAGE"]), assignBinAgentController);
router.patch("/:id", protect, authorize(["PERM_LOCATION_MANAGE"]), updateBinController);
export default router;
