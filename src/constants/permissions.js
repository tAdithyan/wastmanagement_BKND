export const DEFAULT_PERMISSIONS = Object.freeze([
  // User Management Permissions
  { permissionId: "PERM_USER_READ", name: "Read Users", module: "Users", action: "read", description: "View user accounts" },
  { permissionId: "PERM_USER_CREATE", name: "Create Users", module: "Users", action: "create", description: "Create user accounts" },
  { permissionId: "PERM_USER_UPDATE", name: "Update Users", module: "Users", action: "update", description: "Edit user profile and roles" },
  { permissionId: "PERM_USER_DELETE", name: "Delete Users", module: "Users", action: "delete", description: "Delete user accounts" },



  { permissionId: "PERM_ROLE_READ", name: "Read Roles", module: "Roles", action: "read", description: "View user accounts" },
  { permissionId: "PERM_ROLE_CREATE", name: "Create Roles", module: "Roles", action: "create", description: "Create user accounts" },
  { permissionId: "PERM_ROLE_UPDATE", name: "Update Roles", module: "Roles", action: "update", description: "Edit user profile and roles" },
  { permissionId: "PERM_ROLE_DELETE", name: "Delete Roles", module: "Roles", action: "delete", description: "Delete user accounts" },


  { permissionId: "PERM_PICKUP_READ", name: "Read Pickups", module: "Pickups", action: "read", description: "View pickups" },
  { permissionId: "PERM_PICKUP_CREATE", name: "Create Pickups", module: "Pickups", action: "create", description: "Create pickups" },
  { permissionId: "PERM_PICKUP_UPDATE", name: "Update Pickups", module: "Pickups", action: "update", description: "Update pickups" },
  { permissionId: "PERM_PICKUP_DELETE", name: "Delete Pickups", module: "Pickups", action: "delete", description: "Delete pickups" },
  { permissionId: "PERM_PICKUP_CANCEL", name: "Cancel Pickups", module: "Pickups", action: "cancel", description: "Cancel scheduled pickups" },
  { permissionId: "PERM_PICKUP_COMPLETE", name: "Complete Pickups", module: "Pickups", action: "complete", description: "Complete assigned pickups" },
  { permissionId: "PERM_BIN_READ", name: "Read Bins", module: "Bins", action: "read", description: "View bin details after scanning" },
  { permissionId: "PERM_BIN_UPDATE", name: "Update Bins", module: "Bins", action: "update", description: "Update bin operational status" },



  // Waste Collection Permissions
  { permissionId: "PERM_COLLECTION_READ", name: "Read Collection Requests", module: "WasteCollection", action: "read", description: "View waste pickup requests" },
  { permissionId: "PERM_COLLECTION_CREATE", name: "Create Collection Request", module: "WasteCollection", action: "create", description: "Submit waste pickup request" },
  { permissionId: "PERM_COLLECTION_UPDATE", name: "Update Collection Status", module: "WasteCollection", action: "update", description: "Update waste collection status" },
  { permissionId: "PERM_COLLECTION_MANAGE", name: "Manage Collections", module: "WasteCollection", action: "manage", description: "Assign agents and manage schedules" },

  // District & Local Body Permissions
  { permissionId: "PERM_LOCATION_MANAGE", name: "Manage Location Data", module: "Location", action: "manage", description: "Manage districts and local bodies" },

  // Analytics & Reports
  { permissionId: "PERM_REPORTS_READ", name: "View Reports", module: "Reports", action: "read", description: "View system reports and dashboards" },
  { permissionId: "PERM_REPORTS_EXPORT", name: "Export Reports", module: "Reports", action: "export", description: "Export report data to CSV/PDF" },
]);
