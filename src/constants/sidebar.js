export const sidebarSections = [
  ['dashboard', 'Dashboard'], ['pickups', 'Pickups'], ['recurring-pickups', 'Recurring Pickups'],
  ['waste-pricing', 'Waste Pricing'], ['bins', 'Bin Management'], ['active-agents', 'Live Agents'],
  ['agents', 'Agent Details'], ['waste-analysis', 'Waste Analysis'], ['usermanagement', 'Users'],
  ['marketplace', 'Marketplace'], ['permissionManagement', 'Permissions'],
].map(([id, label]) => ({ id, label }));
export const sidebarRoles = [
  { id: 'ROL_2', label: 'Admin' }, { id: 'ROL_3', label: 'Coordinator' }, { id: 'ROL_4', label: 'Collection Agent' },
];
export const normalizeRole = role => ({ SuperAdmin: 'ROL_1', Admin: 'ROL_2', Cordinator: 'ROL_3', CollectionAgent: 'ROL_4', CLIENT_ADMIN: 'ROL_6' }[role] || role);
export const defaultSections = role => sidebarSections.filter(s => s.id !== 'permissionManagement' && (s.id !== 'marketplace' || role === 'ROL_2')).map(s => s.id);
export function validateSidebar(role, sections) {
  return sidebarRoles.some(r => r.id === role) && Array.isArray(sections) &&
    sections.every(id => typeof id === 'string' && sidebarSections.some(s => s.id === id)) &&
    new Set(sections).size === sections.length;
}
