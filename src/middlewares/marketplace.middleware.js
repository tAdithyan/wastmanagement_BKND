import ApiError from '../utils/apiError.js';

export function requireMarketplaceAdmin(req, res, next) {
  if (!req.user || req.user.is_active === false || !['ROL_1', 'ROL_2', 'SuperAdmin', 'Admin'].includes(req.user.role)) {
    return next(new ApiError(403, 'Marketplace administrator access required'));
  }
  next();
}
