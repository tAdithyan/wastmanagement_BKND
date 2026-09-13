import Pickup from '../models/pickup.modal.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { monthWindow } from './agent-details.controller.js';

export async function getWasteAnalysis(req, res, next) {
  try {
    if (!['ROL_1', 'ROL_2', 'ROL_3'].includes(req.user.role)) throw new ApiError(403, 'Staff access required');
    const month = req.query.month || new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
    const { start, end } = monthWindow(month);
    const rows = await Pickup.aggregate([
      { $match: { status: 'completed' } },
      { $addFields: { collectionDate: { $ifNull: ['$completedAt', '$updatedAt'] }, estimated: { $eq: [{ $ifNull: ['$completedAt', null] }, null] } } },
      { $match: { collectionDate: { $gte: start, $lt: end } } },
      { $group: { _id: { day: { $dateToString: { date: '$collectionDate', format: '%Y-%m-%d', timezone: 'Asia/Kolkata' } }, wasteType: '$wasteType' },
        weight: { $sum: '$weight' }, pickups: { $sum: 1 }, estimated: { $sum: { $cond: ['$estimated', 1, 0] } } } },
      { $sort: { '_id.day': 1, '_id.wasteType': 1 } },
    ]);
    res.set('Cache-Control', 'no-store');
    res.json(new ApiResponse(200, { month, rows: rows.map(row => ({ day: row._id.day, wasteType: row._id.wasteType, weight: row.weight, pickups: row.pickups, estimated: row.estimated })) }, 'Daily waste analysis fetched'));
  } catch (error) { next(error); }
}
