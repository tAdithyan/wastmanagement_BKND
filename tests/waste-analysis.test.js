import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=(await readFile(new URL('../src/controllers/waste-analysis.controller.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const fixture=`class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
class ApiResponse{constructor(status,data){this.data=data;}}
const monthWindow=()=>({start:new Date('2026-08-31T18:30:00Z'),end:new Date('2026-09-30T18:30:00Z')});
const Pickup={aggregate:async pipeline=>{globalThis.wastePipeline=pipeline;return [{_id:{day:'2026-09-01',wasteType:'Paper'},weight:20,pickups:2,estimated:1}];}};`;
const {getWasteAnalysis}=await import('data:text/javascript;base64,'+Buffer.from(fixture+source).toString('base64'));
test('waste analytics restricts access and requests completed records grouped in IST',async()=>{
  let error,result;
  await getWasteAnalysis({user:{role:'ROL_4'}},{},e=>{error=e;});assert.equal(error.status,403);
  error=undefined;
  await getWasteAnalysis({user:{role:'ROL_2'},query:{month:'2026-09'}},{set(){},json(value){result=value.data;}},e=>{error=e;});
  assert.equal(error,undefined);assert.equal(result.rows[0].weight,20);
  assert.deepEqual(globalThis.wastePipeline[0],{$match:{status:'completed'}});
  assert.equal(globalThis.wastePipeline[3].$group._id.day.$dateToString.timezone,'Asia/Kolkata');
  delete globalThis.wastePipeline;
});
