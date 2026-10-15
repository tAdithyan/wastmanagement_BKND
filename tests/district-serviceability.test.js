import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkDistrictServiceability, validateCoordinates, updateDistrictServiceability, assertPickupDistrictServiceable } from '../src/services/serviceArea.service.js';

const KERALA_DISTRICT_QUERY = { stateCode: 'IN-KL', boundary: { $exists: true } };
function districtModel(matches = [], configured = 14) {
  const calls = { countFilter: null, geoFilter: null, update: null };
  const model = {
    countDocuments: async filter => { calls.countFilter = filter; return configured; },
    find: filter => ({ select() { return this; }, sort() { return this; }, lean: async () => { calls.geoFilter = filter; return matches; } }),
    findOneAndUpdate: (filter, update, options) => ({ select() { calls.update = { filter, update, options }; return this; }, populate() { return this; }, lean: async () => matches[0] || null }),
  };
  return { model, calls };
}
function radiusModel(matches = []) {
  return {
    countDocuments: async () => matches.length,
    find: filter => ({ select() { this.filter = filter; return this; }, lean: async () => matches }),
  };
}

test('valid GPS coordinates are sent to the Kerala 2dsphere district lookup', async () => {
  const { model, calls } = districtModel([{ districtName: 'Thrissur', stateName: 'Kerala', isServiceable: true }]);
  const result = await checkDistrictServiceability(10.5276, 76.2144, model, radiusModel());
  assert.equal(result.supported, true);
  assert.equal(result.serviceable, true);
  assert.equal(result.district, 'Thrissur');
  assert.deepEqual(calls.countFilter, KERALA_DISTRICT_QUERY);
  assert.deepEqual(calls.geoFilter.boundary.$geoIntersects.$geometry, { type: 'Point', coordinates: [76.2144, 10.5276] });
});

test('a disabled district is identified and returned as restricted', async () => {
  const { model } = districtModel([{ districtName: 'Palakkad', stateName: 'Kerala', isServiceable: false }]);
  const result = await checkDistrictServiceability(10.8, 76.6, model, radiusModel());
  assert.equal(result.supported, true);
  assert.equal(result.serviceable, false);
  assert.equal(result.district, 'Palakkad');
});

test('coordinates outside Kerala boundaries are unsupported rather than classified as restricted', async () => {
  const { model } = districtModel([]);
  const result = await checkDistrictServiceability(12, 80, model, radiusModel());
  assert.deepEqual(result, { supported: false, serviceable: false, district: null, state: null, message: 'This location is outside the supported district dataset.' });
});

test('a shared/overlapping boundary is allowed only when every matching district is enabled', async () => {
  const { model } = districtModel([
    { districtName: 'Ernakulam', stateName: 'Kerala', isServiceable: true },
    { districtName: 'Thrissur', stateName: 'Kerala', isServiceable: false },
  ]);
  const result = await checkDistrictServiceability(10.4, 76.4, model, radiusModel());
  assert.equal(result.serviceable, false);
  assert.deepEqual(result.districts, ['Ernakulam', 'Thrissur']);
});

test('invalid coordinates and missing boundary data fail as verification errors', async () => {
  assert.throws(() => validateCoordinates(91, 76), error => error.statusCode === 400);
  const { model } = districtModel([], 0);
  await assert.rejects(checkDistrictServiceability(10, 76, model, radiusModel()), error => error.statusCode === 503);
});

test('admin status changes persist status and the acting administrator', async () => {
  const updated = { _id: 'district-id', districtName: 'Kollam', stateName: 'Kerala', isServiceable: true };
  const { model, calls } = districtModel([updated]);
  const result = await updateDistrictServiceability('district-id', true, 'admin-id', model);
  assert.equal(result.isServiceable, true);
  assert.equal(calls.update.filter.stateCode, 'IN-KL');
  assert.equal(calls.update.update.$set.updatedBy, 'admin-id');
});

test('pickup creation rejects a location in a disabled district', async () => {
  const { model } = districtModel([{ districtName: 'Kollam', stateName: 'Kerala', isServiceable: false }]);
  await assert.rejects(assertPickupDistrictServiceable(76.6, 8.9, model, radiusModel()), error => error.statusCode === 403 && error.message.includes('Kollam'));
});

test('an active radius grants service within its center even in a disabled district', async () => {
  const { model } = districtModel([{ districtName: 'Kollam', stateName: 'Kerala', isServiceable: false }]);
  const result = await checkDistrictServiceability(8.9, 76.6, model, radiusModel([
    { name: 'Kollam Depot', center: { type: 'Point', coordinates: [76.6, 8.9] }, radiusMeters: 1500 },
  ]));
  assert.equal(result.supported, true);
  assert.equal(result.serviceable, true);
  assert.equal(result.serviceArea, 'Kollam Depot');
});

test('a location beyond an active radius remains unsupported outside enabled districts', async () => {
  const { model } = districtModel([], 14);
  const result = await checkDistrictServiceability(8.902, 76.6, model, radiusModel([
    { name: 'Kollam Depot', center: { type: 'Point', coordinates: [76.6, 8.9] }, radiusMeters: 100 },
  ]));
  assert.equal(result.supported, false);
  assert.equal(result.serviceable, false);
});

test('the checked-in boundary source contains all 14 valid WGS 84 Kerala district geometries', async () => {
  const dataUrl = new URL('../data/kerala-district-boundaries.geojson', import.meta.url);
  const data = JSON.parse(await readFile(dataUrl, 'utf8'));
  const expected = ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'];
  assert.equal(data.features.length, 14);
  assert.deepEqual(data.features.map(feature => feature.properties.districtName).sort(), [...expected].sort());
  for (const feature of data.features) {
    assert.equal(feature.geometry.type, 'MultiPolygon');
    assert.ok(feature.geometry.coordinates.length > 0);
    assert.match(feature.properties.districtName, /.+/);
  }
});
