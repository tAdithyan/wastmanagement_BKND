import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('route preview authorization, validation, and provider response', async () => {
  const source = (await readFile(new URL('../src/controllers/bin-route.controller.js', import.meta.url), 'utf8'))
    .replace(/^import .*;$/gm, '');
  const mocks = `const Bin = {findOne: async (filter) => { globalThis.routeFilter = filter; return {coordinates:{latitude:10,longitude:76}}; }};
    class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
    class ApiResponse { constructor(status,data){this.status=status;this.data=data;} }
    const fetch = async () => ({ok:!globalThis.routeFailure,status:globalThis.routeFailure || 200,json:async()=>{if(globalThis.routeInvalidJson)throw new Error('invalid JSON');return globalThis.routeResponse;}});`;
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
    for (const [status, reason, expected] of [
      [403, 'SERVICE_DISABLED', /not enabled/],
      [403, 'BILLING_DISABLED', /billing is not active/],
      [400, 'API_KEY_INVALID', /rejected the backend/],
      [403, 'API_KEY_ANDROID_APP_BLOCKED', /restrictions block/],
      [403, 'API_KEY_SERVICE_BLOCKED', /restrictions block/],
      [429, 'RESOURCE_EXHAUSTED', /quota/],
      [403, 'PERMISSION_DENIED', /denied the route request/],
      [400, 'INVALID_ARGUMENT', /request format/],
      [500, 'INTERNAL', /temporarily unavailable/],
    ]) {
      globalThis.routeFailure = status;
      globalThis.routeResponse = {error:{message:'private-provider-data',details:[{reason}]}};
      const failure = (await run(req)).error;
      assert.equal(failure.status, 502);
      assert.match(failure.message, expected);
      assert.ok(!failure.message.includes('private-provider-data'));
    }
    globalThis.routeInvalidJson = true;
    assert.match((await run(req)).error.message, /temporarily unavailable/);
  } finally {
    if(previous === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
    else process.env.GOOGLE_ROUTES_API_KEY=previous;
    delete globalThis.routeResponse; delete globalThis.routeFilter;
    delete globalThis.routeFailure; delete globalThis.routeInvalidJson;
  }
});
