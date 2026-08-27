import RecurringPickup from "../models/recurringPickup.model.js";
import Pickup from "../models/pickup.modal.js";
import MonthlyInvoice from "../models/monthlyInvoice.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

export const getClientPortalDashboard = async (req, res, next) => { try {
  if (!["ROL_6", "CLIENT_ADMIN"].includes(req.user.role)) throw new ApiError(403, "Client Admin access required");
  const contractIds = await RecurringPickup.find({ $or: [{ clientAdminId: req.user._id }, { customerId: req.user._id }] }).distinct("_id");
  const pickups = await Pickup.find({ recurringContractId: { $in: contractIds }, status: "completed" }).select("weight amount preferredDate paymentStatus");
  const invoices = await MonthlyInvoice.find({ recurringContractId: { $in: contractIds } }).sort({ billingMonth: -1 });
  const totalWeight = Number(pickups.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(2));
  const totalAmount = Number(pickups.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2));
  const carbonFactor = Number(process.env.CARBON_KG_PER_KG_WASTE || 0.5);
  const carbonAvoided = Number((totalWeight * carbonFactor).toFixed(2));
  const monthlyMap = new Map();
  pickups.forEach((pickup) => {
    const date = new Date(pickup.preferredDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point = monthlyMap.get(key) || { month: key, weight: 0, amount: 0 };
    point.weight += Number(pickup.weight || 0); point.amount += Number(pickup.amount || 0);
    monthlyMap.set(key, point);
  });
  res.json(new ApiResponse(200, {
    activeContracts: contractIds.length,
    completedCollections: pickups.length,
    totalWeight,
    totalAmount,
    carbonAvoided,
    carbonFactor,
    environmentalScore: Math.min(100, Math.round(totalWeight / 10)),
    monthly: [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
    invoices: {
      total: invoices.length,
      unpaid: invoices.filter((invoice) => invoice.status !== "paid").length,
      outstanding: Number(invoices.filter((invoice) => invoice.status !== "paid").reduce((sum, invoice) => sum + invoice.totalAmount, 0).toFixed(2)),
    },
  }, "Client environmental dashboard fetched"));
} catch (error) { next(error); } };
