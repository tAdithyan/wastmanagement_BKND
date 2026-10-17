import { Router } from "express";
import { getAdminPages, getPublicPage, updateAdminPage } from "../controllers/sitePages.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();
router.get("/admin", protect, getAdminPages);
router.put("/admin/:slug", protect, updateAdminPage);
router.get("/:slug", getPublicPage);

export default router;
