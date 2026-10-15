import dotenv from 'dotenv';
import mongoose from 'mongoose';
import District from '../src/models/District.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '../data/kerala-district-boundaries.geojson');
const canonicalNames = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam',
  'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
];
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

try {
  const source = JSON.parse(await readFile(dataPath, 'utf8'));
  const features = source.features || [];
  if (features.length !== canonicalNames.length || canonicalNames.some(name => !features.some(feature => normalize(feature.properties?.districtName) === normalize(name)))) {
    throw new Error('Kerala boundary data must contain exactly the 14 supported canonical districts.');
  }
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error(`Invalid boundary geometry for ${feature.properties?.districtName}.`);
    const visit = node => {
      if (!Array.isArray(node)) throw new Error(`Malformed coordinates for ${feature.properties?.districtName}.`);
      if (node.length && Array.isArray(node[0]) && typeof node[0][0] === 'number') {
        const first = node[0], last = node[node.length - 1];
        if (node.length < 4 || first[0] !== last[0] || first[1] !== last[1]) throw new Error(`Unclosed or undersized boundary ring for ${feature.properties?.districtName}.`);
        for (const position of node) {
          if (position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1]) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) throw new Error(`Invalid WGS 84 position in ${feature.properties?.districtName}.`);
        }
        return;
      }
      node.forEach(visit);
    };
    visit(geometry.coordinates);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const existing = await District.find({}).lean();
  const desired = new Set(canonicalNames.map(normalize));
  const collisions = new Map();
  for (const district of existing) {
    const key = normalize(district.normalizedDistrictName || district.districtName);
    if (!desired.has(key)) continue;
    collisions.set(key, (collisions.get(key) || 0) + 1);
  }
  const duplicate = [...collisions].find(([, count]) => count > 1);
  if (duplicate) throw new Error(`Duplicate existing district records detected for '${duplicate[0]}'. Resolve them before seeding; no records were changed.`);

  const plan = features.map(feature => {
    const { districtName, sourceDistrictCode } = feature.properties;
    const normalizedDistrictName = normalize(districtName);
    const prior = existing.find(district => normalize(district.normalizedDistrictName || district.districtName) === normalizedDistrictName);
    const districtCode = prior?.districtCode ?? Number(sourceDistrictCode);
    const codeCollision = existing.find(district => district.districtCode === districtCode && String(district._id) !== String(prior?._id));
    if (!Number.isInteger(districtCode) || codeCollision) throw new Error(`District code ${districtCode} is invalid or already assigned to '${codeCollision?.districtName || 'another record'}'. No district records were changed.`);
    return { feature, districtName, normalizedDistrictName, prior, districtCode };
  });

  for (const { feature, districtName, normalizedDistrictName, prior, districtCode } of plan) {
    const values = {
      districtCode,
      districtName,
      normalizedDistrictName,
      stateName: 'Kerala',
      stateCode: 'IN-KL',
      isServiceable: typeof prior?.isServiceable === 'boolean' ? prior.isServiceable : false,
      boundary: feature.geometry,
    };
    if (prior) await District.updateOne({ _id: prior._id }, { $set: values });
    else await District.create(values);
  }
  await District.collection.createIndex({ boundary: '2dsphere' }, { name: 'district_boundary_2dsphere', sparse: true });
  await District.collection.createIndex({ normalizedDistrictName: 1, stateCode: 1 }, { name: 'district_normalized_name_state', unique: true, partialFilterExpression: { normalizedDistrictName: { $type: 'string' } } });
  console.log('Seeded and indexed 14 Kerala district boundaries. Existing district serviceability settings were preserved; new districts default to disabled.');
} catch (error) {
  console.error({ errorType: error.name, code: error.code, message: error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URL]') });
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
