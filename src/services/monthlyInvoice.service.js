import MonthlyInvoice from "../models/monthlyInvoice.model.js";
import Pickup from "../models/pickup.modal.js";
import RecurringPickup from "../models/recurringPickup.model.js";

const monthRange = (billingMonth) => {
  const [year, month] = billingMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
};

export const previousBillingMonth = (date = new Date()) => {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
};

export const currentBillingMonth = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const generateMonthlyInvoices = async (billingMonth = previousBillingMonth()) => {
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) throw new Error("Billing month must use YYYY-MM format");
  const { start, end } = monthRange(billingMonth);
  const contracts = await RecurringPickup.find();
  const result = { created: 0, updated: 0, skippedPaid: 0, noEligiblePickups: 0 };
  for (const contract of contracts) {
    const existingInvoice = await MonthlyInvoice.findOne({ recurringContractId: contract._id, billingMonth });
    if (existingInvoice?.status === "paid") {
      result.skippedPaid += 1;
      continue;
    }
    const pickups = await Pickup.find({
      recurringContractId: contract._id,
      status: "completed",
      paymentStatus: { $in: ["pending", "accrued", "invoiced"] },
      preferredDate: { $gte: start, $lt: end },
    });
    if (!pickups.length) {
      result.noEligiblePickups += 1;
      continue;
    }
    const totalAmount = Number(pickups.reduce((sum, pickup) => sum + Number(pickup.amount || 0), 0).toFixed(2));
    const totalWeight = Number(pickups.reduce((sum, pickup) => sum + Number(pickup.weight || 0), 0).toFixed(2));
    const dueDate = new Date(end); dueDate.setDate(10);
    const invoice = await MonthlyInvoice.findOneAndUpdate(
      { recurringContractId: contract._id, billingMonth },
      {
        $set: {
          customerId: contract.customerId,
          pickupIds: pickups.map((pickup) => pickup._id),
          totalAmount,
          totalWeight,
          dueDate,
          status: existingInvoice?.status || "issued",
        },
        $setOnInsert: { issuedAt: new Date() },
      },
      { new: true, upsert: true, runValidators: true }
    );
    await Pickup.updateMany(
      { _id: { $in: invoice.pickupIds } },
      { paymentStatus: "invoiced", monthlyInvoiceId: invoice._id }
    );
    if (existingInvoice) result.updated += 1;
    else result.created += 1;
  }
  return result;
};

let invoiceTimer;
export const startMonthlyInvoiceScheduler = async () => {
  await generateMonthlyInvoices().catch((error) => console.error("Monthly invoice generation failed:", error));
  if (!invoiceTimer) invoiceTimer = setInterval(
    () => generateMonthlyInvoices().catch((error) => console.error("Monthly invoice generation failed:", error)),
    6 * 60 * 60 * 1000
  );
};
