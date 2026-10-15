import District from '../models/District.js';
import ApiError from '../utils/apiError.js';

const KERALA_STATE_CODE = 'IN-KL';

export const validateCoordinates = (latitude, longitude) => {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ApiError(400, 'Valid latitude and longitude are required.');
  }
  return [lng, lat];
};

export const checkDistrictServiceability = async (latitude, longitude, DistrictModel = District) => {
  const coordinates = validateCoordinates(latitude, longitude);
  const boundaryCount = await DistrictModel.countDocuments({ stateCode: KERALA_STATE_CODE, boundary: { $exists: true } });
  if (!boundaryCount) throw new ApiError(503, 'Kerala district boundary data is not configured. Please contact RePamp support.');

  const districts = await DistrictModel.find({
    stateCode: KERALA_STATE_CODE,
    boundary: { $geoIntersects: { $geometry: { type: 'Point', coordinates } } },
  }).select('districtName stateName stateCode isServiceable').sort({ districtName: 1 }).lean();

  if (!districts.length) return { supported: false, serviceable: false, district: null, state: null, message: 'This location is outside the supported district dataset.' };
  const serviceable = districts.every(district => district.isServiceable === true);
  const districtNames = districts.map(district => district.districtName);
  return {
    supported: true,
    serviceable,
    district: districtNames.join(' / '),
    ...(districtNames.length > 1 ? { districts: districtNames } : {}),
    state: districts[0].stateName || 'Kerala',
    message: serviceable ? 'Service is available in your district.' : 'You are in a restricted area.',
  };
};

export const listDistrictServiceability = (DistrictModel = District) => DistrictModel.find({ stateCode: KERALA_STATE_CODE })
  .select('districtName normalizedDistrictName stateName stateCode isServiceable updatedAt updatedBy')
  .populate('updatedBy', 'name')
  .sort({ districtName: 1 })
  .lean();

export const updateDistrictServiceability = async (id, isServiceable, updatedBy, DistrictModel = District) => {
  if (typeof isServiceable !== 'boolean') throw new ApiError(400, 'isServiceable must be true or false.');
  const district = await DistrictModel.findOneAndUpdate(
    { _id: id, stateCode: KERALA_STATE_CODE },
    { $set: { isServiceable, updatedBy } },
    { new: true, runValidators: true },
  ).select('districtName stateName stateCode isServiceable updatedAt updatedBy').populate('updatedBy', 'name').lean();
  if (!district) throw new ApiError(404, 'Supported district not found. Run the district boundary seed script first.');
  return district;
};

export const assertPickupDistrictServiceable = async (longitude, latitude, DistrictModel = District) => {
  const result = await checkDistrictServiceability(latitude, longitude, DistrictModel);
  if (!result.supported) throw new ApiError(403, 'Pickup location is outside the supported Kerala districts.');
  if (!result.serviceable) throw new ApiError(403, `Pickup service is not available in ${result.district}.`);
  return result;
};
