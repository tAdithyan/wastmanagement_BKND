import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import { checkDistrictServiceability, listDistrictServiceability, updateDistrictServiceability } from '../services/serviceArea.service.js';

export const checkLocationServiceability = async (req, res, next) => {
  try {
    const result = await checkDistrictServiceability(req.body?.latitude, req.body?.longitude);
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
};

export const getDistrictServiceability = async (_req, res, next) => {
  try {
    const districts = await listDistrictServiceability();
    res.json(new ApiResponse(200, { configured: districts.length > 0, districts }, 'District serviceability fetched.'));
  } catch (error) { next(error); }
};

export const patchDistrictServiceability = async (req, res, next) => {
  try {
    if (!['ROL_1', 'ROL_2', 'SuperAdmin', 'Admin'].includes(req.user?.role)) throw new ApiError(403, 'Only administrators can manage district serviceability.');
    const district = await updateDistrictServiceability(req.params.id, req.body?.isServiceable, req.user._id);
    res.json(new ApiResponse(200, district, 'District serviceability updated.'));
  } catch (error) { next(error); }
};
