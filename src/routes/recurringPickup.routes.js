import { Router } from "express";
import { createRecurringPickup, getRecurringPickupByQr, listContractCollections, listRecurringPickups, setRecurringPickupStatus, updateRecurringPickup } from "../controllers/recurringPickup.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";

const router = Router();
router.get("/scan/:token", protect, authorize(["PERM_PICKUP_READ"]), getRecurringPickupByQr);
router.get("/:id/collections", protect, authorize(["PERM_PICKUP_READ"]), listContractCollections);
router.get("/", protect, authorize(["PERM_PICKUP_READ"]), listRecurringPickups);
router.post("/", protect, authorize(["PERM_PICKUP_CREATE"]), createRecurringPickup);
router.put("/:id", protect, authorize(["PERM_PICKUP_UPDATE"]), updateRecurringPickup);
router.patch("/:id/status", protect, authorize(["PERM_PICKUP_UPDATE"]), setRecurringPickupStatus);
export default router;
