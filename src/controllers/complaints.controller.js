import Complaint from "../models/complaint.model.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";

const ADMIN_ROLES = new Set(["ROL_1", "ROL_2", "SuperAdmin", "Admin"]);
const requireAdmin = (req) => {
  if (!ADMIN_ROLES.has(req.user?.role)) throw new ApiError(403, "Administrator access is required.");
};

export const createComplaint = async (req, res, next) => {
  try {
    const category = String(req.body.category || "").trim();
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();
    if (!category || !subject || !description) throw new ApiError(400, "Category, subject, and description are required.");
    const complaint = await Complaint.create({ customerId: req.user._id, category, subject, description });
    const populated = await Complaint.findById(complaint._id).populate("customerId", "name email phonenumber userId");
    res.status(201).json(new ApiResponse(201, populated, "Complaint submitted successfully."));
  } catch (error) { next(error); }
};

export const listMyComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ customerId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json(new ApiResponse(200, complaints, "Your complaints fetched successfully."));
  } catch (error) { next(error); }
};

export const listAdminComplaints = async (req, res, next) => {
  try {
    requireAdmin(req);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
    const [items, total] = await Promise.all([
      Complaint.find(filter).populate("customerId", "name email phonenumber userId").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Complaint.countDocuments(filter),
    ]);
    res.json(new ApiResponse(200, { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) }, "Complaints fetched successfully."));
  } catch (error) { next(error); }
};

export const updateComplaint = async (req, res, next) => {
  try {
    requireAdmin(req);
    const updates = {};
    if (req.body.status !== undefined) {
      if (!["submitted", "in_review", "resolved"].includes(req.body.status)) throw new ApiError(400, "Invalid complaint status.");
      updates.status = req.body.status;
    }
    if (req.body.adminResponse !== undefined) updates.adminResponse = String(req.body.adminResponse).trim();
    if (!Object.keys(updates).length) throw new ApiError(400, "Provide a status or response to update.");
    if (updates.adminResponse) updates.respondedBy = req.user._id;
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
      .populate("customerId", "name email phonenumber userId")
      .populate("respondedBy", "name");
    if (!complaint) throw new ApiError(404, "Complaint not found.");
    res.json(new ApiResponse(200, complaint, "Complaint updated successfully."));
  } catch (error) { next(error); }
};
