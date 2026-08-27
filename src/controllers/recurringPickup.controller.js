import mongoose from "mongoose";
import crypto from "node:crypto";
import RecurringPickup from "../models/recurringPickup.model.js";
import Bin from "../models/bin.model.js";
import Pickup from "../models/pickup.modal.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { generateRecurringPickups } from "../services/recurringPickup.service.js";
const isClientAdmin = (user) => ["ROL_6", "CLIENT_ADMIN"].includes(user?.role);
const clientContractFilter = (userId) => ({ $or: [{ clientAdminId: userId }, { customerId: userId }] });

const validate = (body) => {
  if (!mongoose.Types.ObjectId.isValid(body.customerId)) throw new ApiError(400, "Valid customer is required");
  if (!body.name?.trim() || !body.wasteType?.trim()) throw new ApiError(400, "Contract name and waste type are required");
  if (!Array.isArray(body.collectionDays) || !body.collectionDays.length) throw new ApiError(400, "Select at least one collection day");
  if (!Number.isFinite(Number(body.ratePerKg)) || Number(body.ratePerKg) <= 0) throw new ApiError(400, "Rate per kg must be greater than zero");
  const coordinates = body.pickupLocation?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(Number(value)))) {
    throw new ApiError(400, "Valid longitude and latitude are required");
  }
  const [longitude, latitude] = coordinates.map(Number);
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new ApiError(400, "Coordinates must be in [longitude, latitude] order");
  }
};

const normalizedPayload = (body) => ({
  ...body,
  assignedBin: body.assignedBin || null,
  pickupLocation: {
    type: "Point",
    coordinates: body.pickupLocation.coordinates.map(Number),
  },
});

const validateAssignedBin = async (assignedBin, currentContractId = null) => {
  if (!assignedBin) return;
  if (!mongoose.Types.ObjectId.isValid(assignedBin) || !(await Bin.exists({ _id: assignedBin }))) {
    throw new ApiError(400, "Selected bin does not exist");
  }
  const duplicate = await RecurringPickup.findOne({
    assignedBin,
    isActive: true,
    ...(currentContractId ? { _id: { $ne: currentContractId } } : {}),
  });
  if (duplicate) throw new ApiError(409, "This bin is already assigned to another active recurring contract");
};

const validateClientCustomer = async (customerId) => {
  const customer = await User.findOne({ _id: customerId, role: "ROL_6" });
  if (!customer) throw new ApiError(400, "Recurring pickup customer must have the ROL_6 Client Admin role");
  return customer;
};

const validateClientOwnership = (user, customerId) => {
  if (isClientAdmin(user) && String(user._id) !== String(customerId)) {
    throw new ApiError(403, "Client Admin users can only manage their own recurring contract");
  }
};

export const listRecurringPickups = async (_req, res, next) => { try {
  const missingTokens = await RecurringPickup.find({ $or: [{ qrToken: { $exists: false } }, { qrToken: null }] });
  await Promise.all(missingTokens.map((contract) => {
    contract.qrToken = crypto.randomBytes(24).toString("hex");
    return contract.save();
  }));
  const filter = isClientAdmin(_req.user) ? clientContractFilter(_req.user._id) : {};
  const contracts = await RecurringPickup.find(filter)
    .populate("customerId", "name phonenumber address localbody wardNo houseNo pincode")
    .populate("assignedBin", "binId name location status qrToken")
    .populate("clientAdminId", "name phonenumber email userId")
    .sort({ createdAt: -1 });
  res.json(new ApiResponse(200, contracts, "Recurring pickup contracts fetched"));
} catch (error) { next(error); } };

export const createRecurringPickup = async (req, res, next) => { try {
  if (isClientAdmin(req.user)) throw new ApiError(403, "Client Admin users cannot create recurring contracts");
  validate(req.body);
  validateClientOwnership(req.user, req.body.customerId);
  await validateClientCustomer(req.body.customerId);
  await validateAssignedBin(req.body.assignedBin);
  const payload = normalizedPayload(req.body);
  payload.clientAdminId = isClientAdmin(req.user) ? req.user._id : payload.customerId;
  const contract = await RecurringPickup.create(payload);
  await generateRecurringPickups();
  await contract.populate("customerId assignedBin");
  res.status(201).json(new ApiResponse(201, contract, "Recurring pickup contract created"));
} catch (error) { next(error); } };

export const updateRecurringPickup = async (req, res, next) => { try {
  validate(req.body);
  validateClientOwnership(req.user, req.body.customerId);
  await validateClientCustomer(req.body.customerId);
  if (isClientAdmin(req.user)) {
    const existing = await RecurringPickup.findOne({ _id: req.params.id, ...clientContractFilter(req.user._id) });
    if (!existing) throw new ApiError(404, "Recurring pickup contract not found");
    if (String(existing.customerId) !== String(req.body.customerId)) {
      throw new ApiError(403, "Client Admin users cannot change the contract customer");
    }
    if (String(existing.assignedBin || "") !== String(req.body.assignedBin || "")) {
      throw new ApiError(403, "Client Admin users cannot change the assigned bin");
    }
    if (Number(existing.ratePerKg) !== Number(req.body.ratePerKg)) {
      throw new ApiError(403, "Client Admin users cannot change the contract rate");
    }
  }
  await validateAssignedBin(req.body.assignedBin, req.params.id);
  const ownership = isClientAdmin(req.user) ? { _id: req.params.id, ...clientContractFilter(req.user._id) } : { _id: req.params.id };
  const payload = normalizedPayload(req.body);
  payload.clientAdminId = isClientAdmin(req.user) ? req.user._id : payload.customerId;
  const contract = await RecurringPickup.findOneAndUpdate(ownership, payload, { new: true, runValidators: true }).populate("customerId", "name phonenumber address");
  if (!contract) throw new ApiError(404, "Recurring pickup contract not found");
  await generateRecurringPickups();
  res.json(new ApiResponse(200, contract, "Recurring pickup contract updated"));
} catch (error) { next(error); } };

export const setRecurringPickupStatus = async (req, res, next) => { try {
  if (req.body.isActive) {
    const existing = await RecurringPickup.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Recurring pickup contract not found");
    await validateAssignedBin(existing.assignedBin, existing._id);
  }
  const ownership = isClientAdmin(req.user) ? { _id: req.params.id, ...clientContractFilter(req.user._id) } : { _id: req.params.id };
  const contract = await RecurringPickup.findOneAndUpdate(
    ownership,
    { isActive: Boolean(req.body.isActive), "pickupLocation.type": "Point" },
    { new: true, runValidators: true }
  );
  if (!contract) throw new ApiError(404, "Recurring pickup contract not found");
  res.json(new ApiResponse(200, contract, contract.isActive ? "Contract activated" : "Contract paused"));
} catch (error) { next(error); } };

export const getRecurringPickupByQr = async (req, res, next) => { try {
  const contract = await RecurringPickup.findOne({ qrToken: req.params.token })
    .populate("customerId", "name phonenumber address")
    .populate("assignedBin", "binId name location status");
  if (!contract) throw new ApiError(404, "Recurring pickup QR code is invalid");
  res.json(new ApiResponse(200, contract, "Recurring pickup contract fetched"));
} catch (error) { next(error); } };

export const listContractCollections = async (req, res, next) => { try {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid recurring contract ID");
  const contract = await RecurringPickup.findById(req.params.id)
    .populate("customerId", "name phonenumber")
    .populate("assignedBin", "binId name location");
  if (!contract) throw new ApiError(404, "Recurring pickup contract not found");
  const contractCustomerId = contract.customerId?._id || contract.customerId;
  if (isClientAdmin(req.user) && String(contract.clientAdminId || "") !== String(req.user._id) && String(contractCustomerId || "") !== String(req.user._id)) {
    throw new ApiError(403, "This recurring contract is not assigned to you");
  }
  const pickups = await Pickup.find({ recurringContractId: contract._id })
    .populate("operatorId", "name phonenumber userId")
    .sort({ preferredDate: -1 });
  const summary = {
    total: pickups.length,
    scheduled: pickups.filter((pickup) => pickup.status === "scheduled").length,
    completed: pickups.filter((pickup) => pickup.status === "completed").length,
    cancelled: pickups.filter((pickup) => pickup.status === "cancelled").length,
    totalWeight: pickups.reduce((sum, pickup) => sum + Number(pickup.weight || 0), 0),
    totalAmount: pickups.reduce((sum, pickup) => sum + Number(pickup.amount || 0), 0),
  };
  res.json(new ApiResponse(200, { contract, pickups, summary }, "Recurring collection details fetched"));
} catch (error) { next(error); } };
