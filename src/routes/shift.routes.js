import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { addShiftLocation, getActiveShift, listActiveAgentShifts, startShift, stopShift } from "../controllers/shift.controller.js";

const router = Router();
router.get("/", protect, authorize(["PERM_COLLECTION_READ"]), listActiveAgentShifts);
router.get("/active", protect, getActiveShift);
router.post("/start", protect, startShift);
router.post("/:id/location", protect, addShiftLocation);
router.patch("/:id/stop", protect, stopShift);
export default router;
