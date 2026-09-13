import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('route preview authorization, validation, and provider response', async () => {
  const source = (await readFile(new URL('../src/controllers/bin-route.controller.js', import.meta.url), 'utf8'))
    .replace(/^import .*;$/gm, '');
  const mocks = `const Bin = {findOne: async (filter) => { globalThis.routeFilter = filter; return {coordinates:{latitude:10,longitude:76}}; }};
    class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
    class ApiResponse { constructor(status,data){this.status=status;this.data=data;} }
    const fetch = async () => ({ok:true,json:async()=>globalThis.routeResponse});`;
  const { previewBinRoute } = await import(`data:text/javascript;base64,${Buffer.from(mocks + source).toString('base64')}`);
  const req = {user:{role:'ROL_4',_id:'agent'},params:{id:'a'.repeat(24)},body:{origin:{latitude:11,longitude:77}}};
  const run = async (request) => {
    let result, error;
    await previewBinRoute(request, {set(){},json(value){result=value;}}, value => {error=value;});
    return {result,error};
  };
  assert.equal((await run({...req,user:{role:'ROL_3'}})).error.status,403);
  assert.equal((await run({...req,body:{origin:{latitude:null,longitude:77}}})).error.status,400);
  const previous = process.env.GOOGLE_ROUTES_API_KEY;
  try {
    delete process.env.GOOGLE_ROUTES_API_KEY;
    assert.equal((await run(req)).error.status,503);
    process.env.GOOGLE_ROUTES_API_KEY='test';
    globalThis.routeResponse={routes:[]};
    assert.equal((await run(req)).error.status,404);
    globalThis.routeResponse={routes:[{distanceMeters:1000,duration:'120s',polyline:{geoJsonLinestring:{coordinates:[[77,11],[76,10]]}}}]};
    const {result,error}=await run(req);
    assert.equal(error,undefined);
    assert.deepEqual(globalThis.routeFilter,{_id:req.params.id,assignedAgent:'agent'});
    assert.equal(result.data.durationSeconds,120);
    assert.deepEqual(result.data.coordinates[0],{latitude:11,longitude:77});
  } finally {
    if(previous === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
    else process.env.GOOGLE_ROUTES_API_KEY=previous;
    delete globalThis.routeResponse; delete globalThis.routeFilter;
  }
});
