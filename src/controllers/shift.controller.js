import Shift from "../models/shift.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

const assertAgent = (user) => {
  if (user.role !== "ROL_4") throw new ApiError(403, "Only collection agents can manage shifts");
};

export const getActiveShift = async (req, res, next) => {
  try {
    assertAgent(req.user);
    const shift = await Shift.findOne({ agentId: req.user._id, status: "active" });
    res.json(new ApiResponse(200, shift, shift ? "Active shift fetched" : "No active shift"));
  } catch (error) { next(error); }
};

export const listActiveAgentShifts = async (req, res, next) => {
  try {
    const shifts = await Shift.find({ status: "active" })
      .populate("agentId", "name phonenumber whatsappnumber userId role vehicleno")
      .populate("collectedBins", "binId name location coordinates collectedAt")
      .sort({ startedAt: 1 })
      .lean();
    const activeAgents = shifts.filter((shift) => shift.agentId?.role === "ROL_4");
    res.json(new ApiResponse(200, activeAgents, "Active collection agents fetched"));
  } catch (error) { next(error); }
};

export const startShift = async (req, res, next) => {
  try {
    assertAgent(req.user);
    const existing = await Shift.findOne({ agentId: req.user._id, status: "active" });
    if (existing) return res.json(new ApiResponse(200, existing, "Shift is already active"));
    const shift = await Shift.create({ agentId: req.user._id, startedAt: new Date() });
    res.status(201).json(new ApiResponse(201, shift, "Shift started"));
  } catch (error) { next(error); }
};

export const addShiftLocation = async (req, res, next) => {
  try {
    assertAgent(req.user);
    const { latitude, longitude, accuracy, recordedAt } = req.body;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ApiError(400, "Valid latitude and longitude are required");
    }
    const point = { latitude: lat, longitude: lng, accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null, recordedAt: recordedAt || new Date() };
    const shift = await Shift.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user._id, status: "active" },
      { $push: { route: point }, $set: { lastLocation: point } },
      { new: true, runValidators: true }
    );
    if (!shift) throw new ApiError(404, "Active shift not found");
    res.json(new ApiResponse(200, shift.lastLocation, "Shift location recorded"));
  } catch (error) { next(error); }
};

export const stopShift = async (req, res, next) => {
  try {
    assertAgent(req.user);
    const shift = await Shift.findOne({ _id: req.params.id, agentId: req.user._id, status: "active" });
    if (!shift) throw new ApiError(404, "Active shift not found");
    shift.endedAt = new Date();
    shift.durationSeconds = Math.max(0, Math.floor((shift.endedAt.getTime() - shift.startedAt.getTime()) / 1000));
    shift.status = "completed";
    await shift.save();
    res.json(new ApiResponse(200, shift, "Shift stopped"));
  } catch (error) { next(error); }
};
