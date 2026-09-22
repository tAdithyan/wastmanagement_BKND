import { test } from 'node:test';
import assert from 'node:assert/strict';
import Shift from '../src/models/shift.model.js';
import { getActiveShift, startShift, stopShift, addShiftLocation } from '../src/controllers/shift.controller.js';

test('coordinators and agents can start and stop their own shift', async (t) => {
  let filter;
  const shift = { startedAt: new Date(), save: async () => {} };
  t.mock.method(Shift, 'findOne', async (value) => { filter = value; return value._id ? shift : null; });
  t.mock.method(Shift, 'create', async (value) => value);
  for (const role of ['ROL_3', 'ROL_4']) {
    let error;
    let result;
    const res = { status() { return this; }, json(value) { result = value; } };
    const next = (value) => { error = value; };
    const req = { user: { _id: 'staff-1', role }, params: { id: 'shift-1' } };
    await startShift(req, res, next);
    assert.equal(error, undefined);
    assert.equal(result.data.agentId, 'staff-1');
    await stopShift(req, res, next);
    assert.equal(error, undefined);
    assert.deepEqual(filter, { _id: 'shift-1', agentId: 'staff-1', status: 'active' });
    assert.equal(shift.status, 'completed');
  }
});

test('other roles cannot manage shifts', async () => {
  for (const role of ['ROL_1', 'ROL_2', 'ROL_5', 'ROL_6']) {
    for (const handler of [getActiveShift, startShift, stopShift, addShiftLocation]) {
      let error;
      await handler({ user: { role } }, {}, value => { error = value; });
      assert.equal(error.statusCode, 403);
    }
  }
});
