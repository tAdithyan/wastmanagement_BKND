import { Router } from "express";
import { createComplaint, listAdminComplaints, listMyComplaints, updateComplaint } from "../controllers/complaints.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(protect);
router.get("/admin", listAdminComplaints);
router.get("/", listMyComplaints);
router.post("/", createComplaint);
router.patch("/:id", updateComplaint);

export default router;
