import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../src/controllers/agent-details.controller.js', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const { monthWindow, listAgentDetails } = await import(`data:text/javascript;base64,${Buffer.from('class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }\n' + source).toString('base64')}`);
test('month boundaries use IST and reject malformed dates', () => {
  const { start, end } = monthWindow('2026-09');
  assert.equal(start.toISOString(), '2026-08-31T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-09-30T18:30:00.000Z');
  for (const value of ['2026-13', 'bad', '1999-01']) assert.throws(() => monthWindow(value));
});
test('agent and client roles cannot access staff attendance', async () => {
  for (const role of ['ROL_4', 'ROL_5', 'ROL_6']) {
    let error;
    await listAgentDetails({user:{role}}, {}, e => {error=e;});
    assert.equal(error.status,403);
  }
});

test('staff listing includes coordinators and links pickups to their operator', async () => {
  const fixture = `
    class ApiError extends Error {}
    class ApiResponse { constructor(status,data){this.data=data;} }
    const chain = data => ({select(){return this},sort(){return this},populate(){return this},lean:async()=>data});
    const User={find: filter => { if (!['ROL_3','ROL_4','Cordinator','CollectionAgent'].every(role => filter.role.$in.includes(role))) throw new Error('Missing role'); return chain([{_id:'c1',role:'Cordinator'},{_id:'a1',role:'CollectionAgent'}]); }};
    const Shift={find:()=>chain([])};
    const Pickup={find:filter=>{if (!filter.operatorId.$in.includes('c1') || filter.preferredDate.$gte.toISOString() !== '2026-08-31T18:30:00.000Z') throw new Error('Invalid pickup filter'); return chain([{_id:'p1',operatorId:'c1',status:'completed',weight:12}]);}};
  `;
  const module = await import(`data:text/javascript;base64,${Buffer.from(fixture + source).toString('base64')}`);
  let result, error;
  await module.listAgentDetails({user:{role:'ROL_2'},query:{month:'2026-09'}}, {set(){},json(value){result=value.data;}}, e=>{error=e;});
  assert.equal(error,undefined);
  assert.equal(result.agents[0].pickups[0]._id,'p1');
  assert.equal(result.agents[0].role,'ROL_3');
  assert.equal(result.agents[1].role,'ROL_4');
  assert.deepEqual(result.agents[1].pickups,[]);
});
