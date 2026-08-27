import { Router } from "express";
import healthRoutes from "./health.routes.js";
import userRoutes from "./user.routes.js";
import roleRoutes from "./role.routes.js";
import permissionRoutes from "./permission.routes.js";
import pickupRoutes from "./pickup.routes.js";
import homeRoutes from "./home.routes.js";
import locationRoutes from "./location.routes.js";
import wastePriceRoutes from "./wastePrice.routes.js";
import notificationRoutes from "./notification.routes.js";
import binRoutes from "./bin.routes.js";
import shiftRoutes from "./shift.routes.js";
import recurringPickupRoutes from "./recurringPickup.routes.js";
import monthlyInvoiceRoutes from "./monthlyInvoice.routes.js";
import clientPortalRoutes from "./clientPortal.routes.js";
import walletRoutes from "./wallet.routes.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

router.use("/", healthRoutes);
router.use("/", userRoutes);
router.use("/", roleRoutes);
router.use("/", permissionRoutes);
router.use("/pickups", pickupRoutes);
router.use("/home", homeRoutes);
router.use("/locations", locationRoutes);
router.use("/waste-prices", wastePriceRoutes);
router.use("/notifications", notificationRoutes);
router.use("/bins", binRoutes);
router.use("/shifts", shiftRoutes);
router.use("/recurring-pickups", recurringPickupRoutes);
router.use("/monthly-invoices", monthlyInvoiceRoutes);
router.use("/client-portal", clientPortalRoutes);
router.use("/wallet", walletRoutes);
router.use("/dashboard", dashboardRoutes);


export default router;
