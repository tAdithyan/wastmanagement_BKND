import SidebarAccess from '../models/sidebarAccess.model.js';
import { sidebarSections, sidebarRoles, normalizeRole, defaultSections, validateSidebar } from '../constants/sidebar.js';
import ApiError from '../utils/apiError.js';

export function superadminOnly(req, res, next) {
  if (normalizeRole(req.user?.role) !== 'ROL_1') return next(new ApiError(403, 'Only the superadmin can manage sidebar access'));
  next();
}
export async function getMySidebar(req, res, next) {
  try {
    const role = normalizeRole(req.user.role);
    let sections = [];
    if (role === 'ROL_1') sections = [...sidebarSections.map(s => s.id), 'sidebar-access'];
    else if (role === 'ROL_6') sections = ['dashboard', 'contract-details'];
    else if (sidebarRoles.some(r => r.id === role)) {
      const saved = await SidebarAccess.findOne({ roleId: role }).lean();
      sections = saved ? saved.sections : defaultSections(role);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ data: { sections } });
  } catch (error) { next(error); }
}
export async function getSidebarSettings(req, res, next) {
  try {
    const saved = await SidebarAccess.find({}).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ data: { sections: sidebarSections, roles: sidebarRoles.map(role => ({ ...role, sections: saved.find(s => s.roleId === role.id)?.sections ?? defaultSections(role.id) })) } });
  } catch (error) { next(error); }
}
export async function saveSidebarSettings(req, res, next) {
  try {
    if (!validateSidebar(req.params.role, req.body.sections)) throw new ApiError(400, 'Choose a supported staff role and valid, unique sidebar sections');
    const saved = await SidebarAccess.findOneAndUpdate({ roleId: req.params.role }, { $set: { sections: req.body.sections } }, { upsert: true, new: true, runValidators: true });
    res.json({ data: { roleId: saved.roleId, sections: saved.sections } });
  } catch (error) { next(error); }
}
