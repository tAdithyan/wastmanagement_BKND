import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIVE_PICKUP_STATUSES, ACTIVE_PICKUP_MESSAGE } from '../src/constants/pickup-status.js';

const source = await readFile(new URL('../src/services/pickup.service.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export const createPickup ='), source.indexOf('export const updatePickup =')).replace('export const createPickup =', 'const createPickup =');
function setup(initial = [], concurrent = false) {
  const rows = [...initial];
  const Pickup = {
    init: async () => {},
    exists: async ({ customerId, status }) => !concurrent && rows.some(row => row.customerId === customerId && status.$in.includes(row.status)),
    create: async data => {
      if (rows.some(row => row.customerRequest && row.customerId === data.customerId && ACTIVE_PICKUP_STATUSES.includes(row.status))) throw Object.assign(new Error('one_active_customer_request'), {code:11000,keyPattern:{customerId:1}});
      const row = {...data,_id:String(rows.length+1)}; rows.push(row); return row;
    },
  };
  class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
  const create = new Function('Pickup','ApiError','ACTIVE_PICKUP_STATUSES','ACTIVE_PICKUP_MESSAGE','notifyPickupEvent', body + '; return createPickup;')(Pickup,ApiError,ACTIVE_PICKUP_STATUSES,ACTIVE_PICKUP_MESSAGE,async()=>{});
  return {create,rows};
}
test('every active status, including legacy requests, prevents a second request', async () => {
  for(const status of ACTIVE_PICKUP_STATUSES){
    const h=setup([{customerId:'u1',status}]);
    await assert.rejects(h.create({customerId:'u1'}), error=>error.status===409);
    assert.equal(h.rows.length,1);
  }
});
test('terminal statuses and other customers permit new requests', async () => {
  for(const status of ['completed','cancelled','failed']){
    const h=setup([{customerId:'u1',status},{customerId:'u2',status:'assigned'}]);
    const result=await h.create({customerId:'u1',status:'completed',customerRequest:false,recurringContractId:'spoof'});
    assert.equal(result.status,'scheduled'); assert.equal(result.customerRequest,true); assert.equal(result.recurringContractId,null);
  }
});
test('unique-constraint collision becomes a clear conflict when prechecks race', async () => {
  const h=setup([],true);
  const results=await Promise.allSettled([h.create({customerId:'u1'}),h.create({customerId:'u1'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
});
