import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSidebar, defaultSections, normalizeRole } from '../src/constants/sidebar.js';

test('only staff roles and known unique section lists can be configured', () => {
  assert.equal(validateSidebar('ROL_2', ['dashboard', 'pickups']), true);
  assert.equal(validateSidebar('ROL_4', []), true);
  for (const role of ['ROL_1', 'ROL_5', 'ROL_6', 'Admin']) assert.equal(validateSidebar(role, []), false);
  for (const value of [['sidebar-access'], ['account'], ['dashboard', 'dashboard'], [null], 'dashboard']) assert.equal(validateSidebar('ROL_3', value), false);
  assert.equal(normalizeRole('Cordinator'), 'ROL_3');
  assert.equal(defaultSections('ROL_4').includes('permissionManagement'), false);
});

const constants = (await readFile(new URL('../src/constants/sidebar.js', import.meta.url), 'utf8')).replace(/export /g, '');
const source = (await readFile(new URL('../src/controllers/sidebarAccess.controller.js', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const fixture = `class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
const saved = new Map();
const SidebarAccess = {
 findOne: ({roleId}) => ({lean: async()=>saved.get(roleId)}),
 find: () => ({lean: async()=>[...saved.values()]}),
 findOneAndUpdate: async ({roleId}, update) => {const row={roleId,sections:update.$set.sections};saved.set(roleId,row);return row;}
};`;
const controller = await import('data:text/javascript;base64,' + Buffer.from(constants + fixture + source).toString('base64'));
async function call(handler, req) {
  let data, error;
  await handler(req, { set(){}, json(value){data=value.data;} }, err => {error=err;});
  return {data,error};
}
test('only a verified superadmin passes the management gate', async () => {
  for (const role of ['ROL_2', 'ROL_3', 'ROL_4', undefined]) assert.equal((await call(controller.superadminOnly, {user:{role}})).error.status,403);
  for (const role of ['ROL_1', 'SuperAdmin']) assert.equal((await call(controller.superadminOnly, {user:{role}})).error,undefined);
});
test('saved empty sections stay empty, survive reads, and never restrict superadmin', async () => {
  assert.ok((await call(controller.getMySidebar,{user:{role:'ROL_3'}})).data.sections.includes('pickups'));
  assert.equal((await call(controller.saveSidebarSettings,{params:{role:'ROL_3'},body:{sections:[]}})).error,undefined);
  assert.deepEqual((await call(controller.getMySidebar,{user:{role:'Cordinator'}})).data.sections,[]);
  assert.ok((await call(controller.getMySidebar,{user:{role:'SuperAdmin'}})).data.sections.includes('sidebar-access'));
  assert.deepEqual((await call(controller.getMySidebar,{user:{role:'CLIENT_ADMIN'}})).data.sections,['dashboard','contract-details']);
  assert.equal((await call(controller.saveSidebarSettings,{params:{role:'ROL_1'},body:{sections:[]}})).error.status,400);
  const settings = await call(controller.getSidebarSettings,{});
  assert.equal(settings.data.roles.length,3);
  assert.deepEqual(settings.data.roles.find(r=>r.id==='ROL_3').sections,[]);
});
