import ApiError from "./apiError.js";
import RecurringPickup from "../models/recurringPickup.model.js";

export const assertInvoiceAccess = async (user, invoice) => {
  if (user.role === "ROL_5") {
    if (String(invoice.customerId?._id || invoice.customerId) !== String(user._id)) {
      throw new ApiError(403, "This monthly invoice is not assigned to you");
    }
    return;
  }
  if (!["ROL_6", "CLIENT_ADMIN"].includes(user.role)) return;
  const contractId = invoice.recurringContractId?._id || invoice.recurringContractId;
  const allowed = await RecurringPickup.exists({
    _id: contractId,
    $or: [{ clientAdminId: user._id }, { customerId: user._id }],
  });
  if (!allowed) throw new ApiError(403, "This monthly invoice is not assigned to you");
};
