export const ROLES = Object.freeze({
  SUPER_ADMIN: {
    roleId: "ROL_1",
    name: "SuperAdmin",
    description: "Super Administrator with full system access",
  },
  ADMIN: {
    roleId: "ROL_2",
    name: "Admin",
    description: "Administrator with management access",
  },
  CORDINATOR: {
    roleId: "ROL_3",
    name: "Cordinator",
    description: "District / Local Body Coordinator",
  },
  COLLECTION_AGENT: {
    roleId: "ROL_4",
    name: "CollectionAgent",
    description: "Waste Collection Agent",
  },
  USER: {
    roleId: "ROL_5",
    name: "User",
    description: "Standard Public / Citizen User",
  },
  CLIENT_ADMIN: {
    roleId: "ROL_6",
    name: "CLIENT_ADMIN",
    description: "Client organization administrator for recurring collections and billing",
  },
});

export const CONSTANT_ROLES_LIST = Object.values(ROLES);
export const ROLE_IDS = CONSTANT_ROLES_LIST.map((r) => r.roleId);
export const ROLE_NAMES = CONSTANT_ROLES_LIST.map((r) => r.name);
