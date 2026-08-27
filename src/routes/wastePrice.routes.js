import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { authorize } from "../middlewares/role.middleware.js";
import { getWastePricesController, upsertWastePriceController } from "../controllers/wastePrice.controller.js";

const router = Router();

router.get("/", protect, authorize(["PERM_COLLECTION_READ"]), getWastePricesController);
router.put("/:category", protect, authorize(["PERM_COLLECTION_MANAGE"]), upsertWastePriceController);

export default router;
