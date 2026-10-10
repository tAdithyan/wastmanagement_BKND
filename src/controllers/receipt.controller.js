import { randomUUID } from "node:crypto";
import Pickup from "../models/pickup.modal.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { createPickupReceiptHtml } from "../utils/pickupReceiptHtml.js";

const receiptTokens = new Map();
const TOKEN_LIFETIME_MS = 2 * 60 * 1000;

export const loadCompletedPickup = async (id) => {
  const pickup = await Pickup.findById(id).populate("customerId operatorId");
  if (!pickup) throw new ApiError(404, "Pickup not found");
  if (pickup.status !== "completed") throw new ApiError(400, "Receipt is available only for completed pickups");
  return pickup;
};

export const consumeReceiptToken = async (id, token) => {
  const record = receiptTokens.get(token);
  receiptTokens.delete(token);
  if (!record || record.pickupId !== id || record.expiresAt < Date.now()) {
    throw new ApiError(401, "Receipt link is invalid or expired");
  }
  return loadCompletedPickup(id);
};

export const createReceiptLinkController = async (req, res, next) => {
  try {
    const pickup = await loadCompletedPickup(req.params.id);
    const userId = String(req.user._id);
    const isParticipant = [pickup.customerId, pickup.operatorId]
      .filter(Boolean)
      .some((user) => String(user._id) === userId);
    const isManager = ["ROL_1", "ROL_2", "ROL_3", "SuperAdmin", "Admin", "Cordinator"].includes(req.user.role);
    if (!isParticipant && !isManager) throw new ApiError(403, "You cannot download this receipt");

    const token = randomUUID();
    receiptTokens.set(token, { pickupId: String(pickup._id), expiresAt: Date.now() + TOKEN_LIFETIME_MS });
    const downloadUrl = `${req.protocol}://${req.get("host")}/api/v1/pickups/${pickup._id}/receipt.pdf?token=${token}`;
    res.status(200).json(new ApiResponse(200, { downloadUrl, expiresInSeconds: 120 }, "Receipt link created"));
  } catch (error) { next(error); }
};

export const viewReceiptHtmlController = async (req, res, next) => {
  try {
    const pickup = await consumeReceiptToken(req.params.id, req.query.token);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.send(createPickupReceiptHtml(pickup));
  } catch (error) { next(error); }
};
