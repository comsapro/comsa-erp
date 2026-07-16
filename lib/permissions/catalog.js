// Catalogo central de permisos y roles del sistema (Etapa 1).
// Compartido entre el seed (prisma/seed.js) y la capa de autorizacion.
// Convencion de codigo: "<modulo>.<accion>" (ej. clients.create).

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  EXPORT: "export",
};

// Etiquetas legibles por accion, para la UI de asignacion de permisos.
export const ACTION_LABELS = {
  view: "Visualizar",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
};

// Definicion de modulos dentro del alcance de la Etapa 1.
// Cada modulo declara sus acciones disponibles.
export const MODULES = [
  { key: "dashboard", label: "Inicio", actions: ["view"] },
  {
    key: "users",
    label: "Usuarios",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    key: "roles",
    label: "Roles y permisos",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "clients",
    label: "Clientes",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    key: "suppliers",
    label: "Proveedores",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    key: "warehouses",
    label: "Almacenes",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    key: "categories",
    label: "Categorias de productos",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  {
    key: "items",
    label: "Productos e insumos",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  { key: "audit", label: "Bitacora", actions: ["view", "export"] },
];

// Descripciones legibles por modulo (para la columna description de permissions).
const MODULE_DESCRIPTIONS = {
  dashboard: "Inicio",
  users: "Usuarios",
  roles: "Roles y permisos",
  clients: "Clientes",
  suppliers: "Proveedores",
  warehouses: "Almacenes",
  categories: "Categorias de productos",
  items: "Productos e insumos",
  audit: "Bitacora",
};

// Genera la lista plana de permisos: { module, action, code, description }.
export function buildPermissionList() {
  const permissions = [];
  for (const mod of MODULES) {
    for (const action of mod.actions) {
      permissions.push({
        module: mod.key,
        action,
        code: `${mod.key}.${action}`,
        description: `${ACTION_LABELS[action]} - ${MODULE_DESCRIPTIONS[mod.key]}`,
      });
    }
  }
  return permissions;
}

// Todos los codigos de permiso disponibles.
export const ALL_PERMISSION_CODES = buildPermissionList().map((p) => p.code);

// Helpers para construir sets de permisos por rol.
function all(moduleKey) {
  const mod = MODULES.find((m) => m.key === moduleKey);
  return mod ? mod.actions.map((a) => `${moduleKey}.${a}`) : [];
}

function some(moduleKey, actions) {
  return actions.map((a) => `${moduleKey}.${a}`);
}

// Roles iniciales del sistema. El Administrador recibe todos los permisos.
export const SYSTEM_ROLES = [
  {
    name: "Administrador",
    description: "Acceso total al sistema.",
    isSystem: true,
    permissions: "ALL",
  },
  {
    name: "Direccion",
    description: "Visualizacion y exportacion de toda la informacion.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("users", ["view"]),
      ...some("roles", ["view"]),
      ...some("clients", ["view", "export"]),
      ...some("suppliers", ["view", "export"]),
      ...some("warehouses", ["view", "export"]),
      ...some("categories", ["view", "export"]),
      ...some("items", ["view", "export"]),
      ...some("audit", ["view", "export"]),
    ],
  },
  {
    name: "Ventas",
    description: "Gestion de clientes y consulta de catalogo.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("clients", ["view", "create", "edit", "export"]),
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
    ],
  },
  {
    name: "Produccion",
    description: "Consulta de productos, categorias y almacenes.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
      ...some("warehouses", ["view"]),
    ],
  },
  {
    name: "Compras",
    description: "Gestion de proveedores y consulta de catalogo.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("suppliers", ["view", "create", "edit", "export"]),
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
    ],
  },
  {
    name: "Almacen",
    description: "Gestion de almacenes, categorias y productos.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...all("warehouses"),
      ...all("categories"),
      ...some("items", ["view", "create", "edit", "export"]),
    ],
  },
  {
    name: "Administracion",
    description: "Consulta administrativa de clientes, proveedores y usuarios.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("users", ["view"]),
      ...some("clients", ["view", "export"]),
      ...some("suppliers", ["view", "export"]),
      ...some("items", ["view"]),
      ...some("audit", ["view"]),
    ],
  },
];
