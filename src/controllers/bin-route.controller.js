import Bin from '../models/bin.model.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';

const validPoint = (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
  && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

export async function previewBinRoute(req, res, next) {
  try {
    if (req.user.role !== 'ROL_4') throw new ApiError(403, 'Collection Agent access required');
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new ApiError(400, 'Invalid bin ID');
    if (!validPoint(req.body.origin)) throw new ApiError(400, 'Valid starting coordinates are required');
    const bin = await Bin.findOne({ _id: req.params.id, assignedAgent: req.user._id });
    if (!bin) throw new ApiError(404, 'Assigned bin not found');
    if (!validPoint(bin.coordinates)) throw new ApiError(400, 'This bin has no valid GPS location');
    const key = process.env.GOOGLE_ROUTES_API_KEY;
    if (!key) throw new ApiError(503, 'Route previews are not configured yet. Contact your administrator.');
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring' },
      body: JSON.stringify({ origin: { location: { latLng: req.body.origin } },
        destination: { location: { latLng: { latitude: bin.coordinates.latitude, longitude: bin.coordinates.longitude } } },
        travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE',
        polylineEncoding: 'GEO_JSON_LINESTRING', units: 'METRIC' }),
    });
    if (!response.ok) throw new ApiError(502, 'The route service is unavailable. Please try again later.');
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) throw new ApiError(404, 'No driving route was found to this bin.');
    const coordinates = route.polyline?.geoJsonLinestring?.coordinates?.map(([longitude, latitude]) => ({ latitude, longitude }));
    const durationSeconds = Number(route.duration?.replace(/s$/, ''));
    if (!coordinates || coordinates.length < 2 || !coordinates.every(validPoint)
      || !Number.isFinite(durationSeconds) || !Number.isFinite(route.distanceMeters)) {
      throw new ApiError(502, 'The route service returned an invalid route. Please try again.');
    }
    res.set('Cache-Control', 'no-store');
    res.json(new ApiResponse(200, { coordinates, distanceMeters: route.distanceMeters, durationSeconds }, 'Route preview ready'));
  } catch (error) {
    next(error.name === 'TimeoutError' ? new ApiError(504, 'Route request timed out. Please try again.') : error);
  }
}
