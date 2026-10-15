// Converts the NWIC/GSI all-India GeoJSON (EPSG:7755) into a compact WGS84
// Kerala-only GeoJSON suitable for MongoDB GeoJSON/2dsphere queries.
const fs = require('node:fs');
const path = require('node:path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/extract/district_nwic.GeoJSON');
const outputPath = process.argv[3] || path.join(__dirname, '../data/kerala-district-boundaries.geojson');
const canonicalNames = new Map([
  'thiruvananthapuram', 'Thiruvananthapuram', 'kollam', 'Kollam', 'pathanamthitta', 'Pathanamthitta',
  'alappuzha', 'Alappuzha', 'kottayam', 'Kottayam', 'idukki', 'Idukki', 'ernakulam', 'Ernakulam',
  'thrissur', 'Thrissur', 'palakkad', 'Palakkad', 'malappuram', 'Malappuram', 'kozhikode', 'Kozhikode',
  'wayanad', 'Wayanad', 'kannur', 'Kannur', 'kasaragod', 'Kasaragod',
].reduce((map, value, index, values) => { if (index % 2 === 0) map.set(values[index], values[index + 1]); return map; }, new Map()));

const a = 6378137;
const f = 1 / 298.257223563;
const eccentricity = Math.sqrt(2 * f - f * f);
const radians = value => value * Math.PI / 180;
const degrees = value => value * 180 / Math.PI;
const m = phi => Math.cos(phi) / Math.sqrt(1 - eccentricity ** 2 * Math.sin(phi) ** 2);
const t = phi => Math.tan(Math.PI / 4 - phi / 2) / (((1 - eccentricity * Math.sin(phi)) / (1 + eccentricity * Math.sin(phi))) ** (eccentricity / 2));
const phi1 = radians(12.472955), phi2 = radians(35.1728044444444);
const n = (Math.log(m(phi1)) - Math.log(m(phi2))) / (Math.log(t(phi1)) - Math.log(t(phi2)));
const F = m(phi1) / (n * t(phi1) ** n);
const rho0 = a * F * t(radians(24)) ** n;

function inverseIndiaNsf([easting, northing]) {
  const x = easting - 4000000, y = northing - 4000000;
  const rho = Math.sign(n) * Math.hypot(x, rho0 - y);
  const theta = Math.atan2(x, rho0 - y);
  const targetT = (rho / (a * F)) ** (1 / n);
  let latitude = Math.PI / 2 - 2 * Math.atan(targetT);
  for (let index = 0; index < 12; index += 1) {
    const next = Math.PI / 2 - 2 * Math.atan(targetT * (((1 - eccentricity * Math.sin(latitude)) / (1 + eccentricity * Math.sin(latitude))) ** (eccentricity / 2)));
    if (Math.abs(next - latitude) < 1e-13) { latitude = next; break; }
    latitude = next;
  }
  const longitude = radians(80) + theta / n;
  const result = [degrees(longitude), degrees(latitude)];
  if (result[0] < 72 || result[0] > 79 || result[1] < 7 || result[1] > 14) throw new Error(`Unexpected transformed Kerala coordinate ${result}`);
  return result;
}

function transformCoordinates(value) {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return inverseIndiaNsf(value);
  return value.map(transformCoordinates);
}

async function main() {
  const fd = fs.openSync(inputPath, 'r');
  const head = Buffer.alloc(8192);
  const read = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const marker = head.subarray(0, read).toString('utf8').match(/"features"\s*:\s*\[/);
  if (!marker) throw new Error('Input has no GeoJSON features array.');
  const arrayStart = marker.index + marker[0].length;
  const output = [];
  let active = false, depth = 0, inString = false, escaped = false, segmentStart = 0, pieces = [];
  for await (const chunk of fs.createReadStream(inputPath, { start: arrayStart })) {
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (!active) {
        if (byte !== 123) continue;
        active = true; depth = 1; inString = false; escaped = false; segmentStart = index; pieces = [];
        continue;
      }
      if (inString) {
        if (escaped) escaped = false;
        else if (byte === 92) escaped = true;
        else if (byte === 34) inString = false;
        continue;
      }
      if (byte === 34) inString = true;
      else if (byte === 123) depth += 1;
      else if (byte === 125 && --depth === 0) {
        pieces.push(chunk.subarray(segmentStart, index + 1));
        const feature = JSON.parse(Buffer.concat(pieces).toString('utf8'));
        const props = feature.properties || {};
        const key = String(props.district || '').trim().toLowerCase();
        if (String(props.state_name || '').trim().toLowerCase() === 'kerala' && canonicalNames.has(key)) {
          if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error(`Unsupported geometry for ${props.district}`);
          feature.properties = { districtName: canonicalNames.get(key), sourceDistrictCode: String(props.dtcode || '') };
          feature.geometry.coordinates = transformCoordinates(feature.geometry.coordinates);
          output.push(feature);
        }
        active = false;
      }
    }
    if (active) { pieces.push(chunk.subarray(segmentStart)); segmentStart = 0; }
  }
  if (output.length !== 14) throw new Error(`Expected 14 Kerala districts, found ${output.length}: ${output.map(feature => feature.properties.districtName).join(', ')}`);
  output.sort((left, right) => left.properties.districtName.localeCompare(right.properties.districtName));
  const collection = { type: 'FeatureCollection', name: 'kerala_district_boundaries', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } }, features: output };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(collection));
  console.log(`Wrote ${output.length} Kerala district boundaries to ${outputPath}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
