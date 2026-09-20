import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=(await readFile(new URL('../src/controllers/waste-analysis.controller.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const fixture=`class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
class ApiResponse{constructor(status,data){this.data=data;}}
const monthWindow=()=>({start:new Date('2026-08-31T18:30:00Z'),end:new Date('2026-09-30T18:30:00Z')});
const Pickup={aggregate:async pipeline=>{if(pipeline.some(stage=>stage.$lookup)){globalThis.locationPipeline=pipeline;return [{_id:{districtId:'d1',district:'Ernakulam',type:'panjayath',localBody:'Test Panchayat'},weight:20,pickups:2}];}globalThis.wastePipeline=pipeline;return [{_id:{day:'2026-09-01',wasteType:'Paper'},weight:20,pickups:2,estimated:1}];}};`;
const {getWasteAnalysis}=await import('data:text/javascript;base64,'+Buffer.from(fixture+source).toString('base64'));
test('waste analytics restricts access and requests completed records grouped in IST',async()=>{
  let error,result;
  await getWasteAnalysis({user:{role:'ROL_4'}},{},e=>{error=e;});assert.equal(error.status,403);
  error=undefined;
  await getWasteAnalysis({user:{role:'ROL_2'},query:{month:'2026-09'}},{set(){},json(value){result=value.data;}},e=>{error=e;});
  assert.equal(error,undefined);assert.equal(result.rows[0].weight,20);
  assert.deepEqual(globalThis.wastePipeline[0],{$match:{status:'completed'}});
  assert.equal(globalThis.wastePipeline[3].$group._id.day.$dateToString.timezone,'Asia/Kolkata');
  assert.equal(result.locations[0].localBody, 'Test Panchayat');
  assert.equal(result.locations[0].weight, 20);
  assert.deepEqual(globalThis.locationPipeline[0], { $match: { status: 'completed' } });
  assert.equal(globalThis.locationPipeline[4].$unwind.preserveNullAndEmptyArrays, true);
  delete globalThis.locationPipeline;
  delete globalThis.wastePipeline;
});

const summarySource = await readFile(new URL('../../FrontEnd/src/pages/WasteAnalysis/summary.js', import.meta.url), 'utf8');
const { summarizeLocations } = await import('data:text/javascript;base64,' + Buffer.from(summarySource).toString('base64'));
test('area totals include missing locations and distinguish local bodies in different districts', () => {
  const result = summarizeLocations([
    { districtId: 'a', district: 'District A', type: 'panjayath', localBody: 'Same name', weight: 20, pickups: 2 },
    { districtId: 'a', district: 'District A', type: 'municipalaty', localBody: 'Town', weight: 30, pickups: 3 },
    { districtId: 'b', district: 'District B', type: 'panjayath', localBody: 'Same name', weight: 10, pickups: 1 },
    { district: 'Unknown district', type: 'unknown', localBody: '', weight: 5, pickups: 1 },
  ]);
  assert.equal(result.districts[0].weight, 50);
  assert.equal(result.districts.reduce((sum, d) => sum + d.weight, 0), 65);
  assert.equal(result.panchayats.length, 2);
  assert.notEqual(result.panchayats[0].key, result.panchayats[1].key);
  assert.equal(result.municipalities[0].weight, 30);
  assert.equal(result.unknownPickups, 1);
  assert.deepEqual(summarizeLocations([]).districts, []);
});
