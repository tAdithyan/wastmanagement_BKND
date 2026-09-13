import User from '../models/user.model.js';
import Shift from '../models/shift.model.js';
import Pickup from '../models/pickup.modal.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';

export function monthWindow(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000 || Number(month.slice(0, 4)) > 2100) {
    throw new ApiError(400, 'Select a valid month');
  }
  const [year, number] = month.split('-').map(Number);
  const offset = 330 * 60000;
  return { start: new Date(Date.UTC(year, number - 1, 1) - offset), end: new Date(Date.UTC(year, number, 1) - offset) };
}

export async function listAgentDetails(req, res, next) {
  try {
    if (!['ROL_1', 'ROL_2', 'ROL_3'].includes(req.user.role)) throw new ApiError(403, 'Staff access required');
    const month = req.query.month || new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
    const { start, end } = monthWindow(month);
    const users = await User.find({ role: { $in: ['ROL_3', 'ROL_4', 'Cordinator', 'CollectionAgent'] } }).select('name role userId phonenumber email vehicleno is_active createdAt').sort({ name: 1 }).lean();
    const agents = users.map(user => ({ ...user, role: ({ Cordinator: 'ROL_3', CollectionAgent: 'ROL_4' })[user.role] || user.role }));
    const ids = agents.map(agent => agent._id);
    const pickups = await Pickup.find({ operatorId: { $in: ids }, preferredDate: { $gte: start, $lt: end } })
      .select('operatorId pickupId customerId wasteType preferredDate status weight amount paymentStatus')
      .populate('customerId', 'name').sort({ preferredDate: -1 }).lean();
    const pickupsByAgent = new Map();
    for (const pickup of pickups) {
      const id = String(pickup.operatorId);
      const list = pickupsByAgent.get(id) || [];
      list.push(pickup);
      pickupsByAgent.set(id, list);
    }
    // Include shifts crossing a month boundary and active shifts for current status.
    const shifts = await Shift.find({ agentId: { $in: ids }, $or: [
      { status: 'active' }, { startedAt: { $lt: end }, endedAt: { $gt: start } },
    ] }).select('agentId status startedAt endedAt durationSeconds lastLocation collectedBins').sort({ startedAt: -1 }).lean();
    const byAgent = new Map();
    for (const shift of shifts) {
      const id = String(shift.agentId);
      const list = byAgent.get(id) || [];
      list.push({ ...shift, collectedBinCount: shift.collectedBins?.length || 0, collectedBins: undefined });
      byAgent.set(id, list);
    }
    res.set('Cache-Control', 'no-store');
    res.json(new ApiResponse(200, { month, timezone: 'Asia/Kolkata', agents: agents.map(agent => ({ ...agent, shifts: byAgent.get(String(agent._id)) || [], pickups: pickupsByAgent.get(String(agent._id)) || [] })) }, 'Agent details fetched'));
  } catch (error) { next(error); }
}
