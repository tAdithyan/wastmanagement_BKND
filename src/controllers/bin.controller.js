import Bin from "../models/bin.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import Shift from "../models/shift.model.js";
import User from "../models/user.model.js";

const ALLOWED_STATUSES = [ "Pending",
        "Collected",];
const validateStatus = (status) => { if (!ALLOWED_STATUSES.includes(status)) throw new ApiError(400, "Invalid bin status"); };

export const listBinsController = async (_req, res, next) => { try { const bins = await Bin.find().populate("assignedAgent", "name phonenumber userId is_active").sort({ createdAt: -1 }); res.json(new ApiResponse(200, bins, "Bins fetched successfully")); } catch (error) { next(error); } };
export const listMyAssignedBinsController = async (req, res, next) => { try {
  if (req.user.role !== "ROL_4") throw new ApiError(403, "Collection Agent access required");
  const bins = await Bin.find({ assignedAgent: req.user._id }).sort({ status: -1, createdAt: -1 });
  res.json(new ApiResponse(200, bins, "Assigned bins fetched successfully"));
} catch (error) { next(error); } };
export const createBinController = async (req, res, next) => { try { const { name, location, coordinates } = req.body; const bin = await Bin.create({ name, location, coordinates }); res.status(201).json(new ApiResponse(201, bin, "Bin created successfully")); } catch (error) { next(error); } };
export const updateBinController = async (req, res, next) => { try { if (req.body.status) validateStatus(req.body.status); const update = { ...req.body, ...(req.body.status ? { statusUpdatedAt: new Date() } : {}) }; delete update.qrToken; delete update.binId; const bin = await Bin.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }); if (!bin) throw new ApiError(404, "Bin not found"); res.json(new ApiResponse(200, bin, "Bin updated successfully")); } catch (error) { next(error); } };
export const getScannedBinController = async (req, res, next) => { try { const bin = await Bin.findOneAndUpdate({ qrToken: req.params.token }, { lastScannedAt: new Date() }, { new: true }); if (!bin) throw new ApiError(404, "Bin QR code is invalid"); res.json(new ApiResponse(200, bin, "Bin fetched successfully")); } catch (error) { next(error); } };
export const updateScannedBinStatusController = async (req, res, next) => {
  try {
    validateStatus(req.body.status);
    const previousBin = await Bin.findOne({ qrToken: req.params.token });
    if (!previousBin) throw new ApiError(404, "Bin QR code is invalid");
    const now = new Date();
    const update = { status: req.body.status, statusUpdatedAt: now, lastScannedAt: now };
    let activeShift = null;

    if (req.body.status === "Collected" && req.user.role === "ROL_4") {
      if (previousBin.assignedAgent && String(previousBin.assignedAgent) !== String(req.user._id)) {
        throw new ApiError(403, "This bin is assigned to another collection agent");
      }
      activeShift = await Shift.findOne({ agentId: req.user._id, status: "active" });
      if (!activeShift) throw new ApiError(400, "Start your vehicle shift before collecting a bin");
      update.collectedBy = req.user._id;
      update.collectedShift = activeShift._id;
      update.collectedAt = now;
    } else if (req.body.status === "Pending") {
      update.collectedBy = null;
      update.collectedShift = null;
      update.collectedAt = null;
    }

    const bin = await Bin.findByIdAndUpdate(previousBin._id, update, { new: true, runValidators: true });

    if (activeShift) {
      await Shift.findByIdAndUpdate(activeShift._id, { $addToSet: { collectedBins: bin._id } });
    }
    if (req.body.status === "Pending" && previousBin.collectedShift) {
      await Shift.findByIdAndUpdate(previousBin.collectedShift, { $pull: { collectedBins: bin._id } });
    }
    res.json(new ApiResponse(200, bin, "Bin status updated successfully"));
  } catch (error) { next(error); }
};
export const assignBinAgentController = async (req, res, next) => { try {
  const assignedAgent = req.body.assignedAgent || null;
  if (assignedAgent) {
    const agent = await User.findOne({ _id: assignedAgent, role: "ROL_4", is_active: true });
    if (!agent) throw new ApiError(400, "Select an active ROL_4 collection agent");
  }
  const bin = await Bin.findByIdAndUpdate(req.params.id, { assignedAgent }, { new: true, runValidators: true })
    .populate("assignedAgent", "name phonenumber userId is_active");
  if (!bin) throw new ApiError(404, "Bin not found");
  res.json(new ApiResponse(200, bin, assignedAgent ? "Collection agent assigned" : "Collection agent removed"));
} catch (error) { next(error); } };
export const updateScannedBinLocationController = async (req, res, next) => { try { const location = String(req.body.location || "").trim(); if (!location) throw new ApiError(400, "Bin location is required"); const coordinates = req.body.coordinates || { latitude: null, longitude: null }; const latitude = coordinates.latitude == null ? null : Number(coordinates.latitude); const longitude = coordinates.longitude == null ? null : Number(coordinates.longitude); if ((latitude != null && !Number.isFinite(latitude)) || (longitude != null && !Number.isFinite(longitude))) throw new ApiError(400, "Invalid location coordinates"); const bin = await Bin.findOneAndUpdate({ qrToken: req.params.token }, { location, coordinates: { latitude, longitude }, lastScannedAt: new Date() }, { new: true, runValidators: true }); if (!bin) throw new ApiError(404, "Bin QR code is invalid"); res.json(new ApiResponse(200, bin, "Bin location updated successfully")); } catch (error) { next(error); } };
