import { Router } from "express";
import { createWalletTopupOrder, getWallet, verifyWalletTopup } from "../controllers/wallet.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();
router.get("/", protect, getWallet);
router.post("/topups/order", protect, createWalletTopupOrder);
router.post("/topups/verify", protect, verifyWalletTopup);
export default router;
