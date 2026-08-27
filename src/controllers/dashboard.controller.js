import Bin from "../models/bin.model.js";
import MonthlyInvoice from "../models/monthlyInvoice.model.js";
import Pickup from "../models/pickup.modal.js";
import RecurringPickup from "../models/recurringPickup.model.js";
import Shift from "../models/shift.model.js";
import User from "../models/user.model.js";
import ApiResponse from "../utils/apiResponse.js";

export const getOperationsDashboard = async (req, res, next) => { try {
  const isAgent = req.user.role === "ROL_4";
  const pickupFilter = isAgent ? { operatorId: req.user._id } : {};
  const binFilter = isAgent ? { assignedAgent: req.user._id } : {};
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [users, pickups, bins, activeContracts, invoices, activeShifts, monthly, recentPickups] = await Promise.all([
    isAgent ? [] : User.find().select("role is_active").lean(),
    Pickup.find(pickupFilter).select("status weight amount").lean(),
    Bin.find(binFilter).select("status assignedAgent").lean(),
    isAgent ? 0 : RecurringPickup.countDocuments({ isActive: true }),
    isAgent ? [] : MonthlyInvoice.find().select("status totalAmount").lean(),
    isAgent ? Shift.countDocuments({ agentId: req.user._id, status: "active" }) : Shift.countDocuments({ status: "active" }),
    Pickup.aggregate([
      { $match: { ...pickupFilter, status: "completed", preferredDate: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: "$preferredDate" }, month: { $month: "$preferredDate" } }, weight: { $sum: "$weight" }, amount: { $sum: "$amount" }, collections: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    Pickup.find(pickupFilter).populate("customerId", "name phonenumber").populate("operatorId", "name userId").sort({ createdAt: -1 }).limit(7).lean(),
  ]);

  const statusCounts = pickups.reduce((result, pickup) => { result[pickup.status] = (result[pickup.status] || 0) + 1; return result; }, {});
  const completed = pickups.filter((pickup) => pickup.status === "completed");
  const openStatuses = ["scheduled", "assigned", "on_the_way", "in_progress"];
  const monthlyMap = new Map(monthly.map((item) => [`${item._id.year}-${String(item._id.month).padStart(2, "0")}`, item]));
  const monthlyTrend = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - offset));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const item = monthlyMap.get(key);
    return { month: key, weight: Number((item?.weight || 0).toFixed(2)), amount: Number((item?.amount || 0).toFixed(2)), collections: item?.collections || 0 };
  });

  const data = {
    users: { total: users.length, active: users.filter((user) => user.is_active !== false).length, customers: users.filter((user) => ["ROL_5", "ROL_6"].includes(user.role)).length, agents: users.filter((user) => user.role === "ROL_4").length },
    pickups: { total: pickups.length, open: pickups.filter((pickup) => openStatuses.includes(pickup.status)).length, completed: completed.length, cancelled: statusCounts.cancelled || 0, statuses: statusCounts, totalWeight: Number(completed.reduce((sum, pickup) => sum + Number(pickup.weight || 0), 0).toFixed(2)), totalAmount: Number(completed.reduce((sum, pickup) => sum + Number(pickup.amount || 0), 0).toFixed(2)) },
    bins: { total: bins.length, pending: bins.filter((bin) => bin.status === "Pending").length, collected: bins.filter((bin) => bin.status === "Collected").length, assigned: bins.filter((bin) => bin.assignedAgent).length },
    recurring: { active: activeContracts },
    billing: { outstanding: Number(invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0).toFixed(2)), unpaid: invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).length, paid: invoices.filter((invoice) => invoice.status === "paid").length },
    activeShifts,
    monthlyTrend,
    recentPickups,
  };
  res.json(new ApiResponse(200, data, "Operations dashboard fetched"));
} catch (error) { next(error); } };
