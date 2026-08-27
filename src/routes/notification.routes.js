import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { listNotificationsController, readAllNotificationsController, readNotificationController } from "../controllers/notification.controller.js";

const router = Router();
router.get("/", protect, listNotificationsController);
router.patch("/read-all", protect, readAllNotificationsController);
router.patch("/:id/read", protect, readNotificationController);
export default router;
