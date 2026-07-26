// Catalogo central de permisos y roles del sistema (Etapas 1, 2 y 3).
// Compartido entre el seed (prisma/seed.js) y la capa de autorizacion.
// Convencion de codigo: "<modulo>.<accion>" (ej. clients.create).

export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  EDIT: "edit",
  DELETE: "delete",
  EXPORT: "export",
};

export const ACTION_LABELS = {
  view: "Visualizar",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  export: "Exportar",
  manage: "Administrar",
  delete_draft: "Eliminar borrador",
  submit: "Enviar a aprobacion",
  approve: "Aprobar",
  reject: "Rechazar",
  return_to_draft: "Devolver a borrador",
  cancel: "Cancelar",
  print: "Imprimir",
  view_cost: "Ver costos",
  view_benefit: "Ver beneficio",
  edit_benefit: "Editar beneficio",
  apply_discount: "Aplicar descuento",
  send_to_production: "Enviar a produccion",
  convert_to_quote: "Convertir a cotizacion",
  start: "Iniciar",
  update_progress: "Actualizar avance",
  complete_item: "Completar item",
  complete_order: "Completar orden",
  create_entry: "Registrar entrada",
  create_exit: "Registrar salida",
  adjust: "Ajustar inventario",
  transfer: "Transferir entre almacenes",
  receive: "Recibir mercancia",
  quotations_pdf: "PDF cotizaciones",
  production_pdf: "PDF produccion",
  inventory_pdf: "PDF inventario",
  purchases_pdf: "PDF compras",
};

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
  {
    key: "issuing_companies",
    label: "Empresas emisoras",
    actions: ["view", "create", "edit", "manage"],
  },
  {
    key: "manufacturing_processes",
    label: "Procesos de manufactura",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "installation_concepts",
    label: "Conceptos de instalacion",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "quote_templates",
    label: "Biblioteca de items",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "quotes",
    label: "Cotizaciones",
    actions: [
      "view",
      "create",
      "edit",
      "delete_draft",
      "submit",
      "approve",
      "reject",
      "return_to_draft",
      "cancel",
      "print",
      "view_cost",
      "view_benefit",
      "edit_benefit",
      "apply_discount",
      "send_to_production",
    ],
  },
  {
    key: "direct_orders",
    label: "Ordenes directas",
    actions: [
      "view",
      "create",
      "edit",
      "delete_draft",
      "submit",
      "approve",
      "reject",
      "cancel",
      "convert_to_quote",
      "send_to_production",
    ],
  },
  {
    key: "production",
    label: "Produccion",
    actions: [
      "view",
      "start",
      "update_progress",
      "complete_item",
      "complete_order",
      "cancel",
      "print",
    ],
  },
  {
    key: "inventory",
    label: "Inventario",
    actions: [
      "view",
      "view_cost",
      "create_entry",
      "create_exit",
      "adjust",
      "transfer",
    ],
  },
  {
    key: "purchase_orders",
    label: "Ordenes de compra",
    actions: [
      "view",
      "create",
      "edit",
      "submit",
      "approve",
      "reject",
      "cancel",
      "receive",
      "print",
    ],
  },
  {
    key: "reports",
    label: "Reportes PDF",
    actions: [
      "quotations_pdf",
      "production_pdf",
      "inventory_pdf",
      "purchases_pdf",
    ],
  },
];

const MODULE_DESCRIPTIONS = Object.fromEntries(
  MODULES.map((m) => [m.key, m.label])
);

export function buildPermissionList() {
  const permissions = [];
  for (const mod of MODULES) {
    for (const action of mod.actions) {
      permissions.push({
        module: mod.key,
        action,
        code: `${mod.key}.${action}`,
        description: `${ACTION_LABELS[action] || action} - ${MODULE_DESCRIPTIONS[mod.key]}`,
      });
    }
  }
  return permissions;
}

export const ALL_PERMISSION_CODES = buildPermissionList().map((p) => p.code);

function all(moduleKey) {
  const mod = MODULES.find((m) => m.key === moduleKey);
  return mod ? mod.actions.map((a) => `${moduleKey}.${a}`) : [];
}

function some(moduleKey, actions) {
  return actions.map((a) => `${moduleKey}.${a}`);
}

export const SYSTEM_ROLES = [
  {
    name: "Administrador",
    description: "Acceso total al sistema.",
    isSystem: true,
    permissions: "ALL",
  },
  {
    name: "Direccion",
    description: "Visualizacion, aprobaciones y consulta comercial.",
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
      ...some("issuing_companies", ["view"]),
      ...some("manufacturing_processes", ["view"]),
      ...some("installation_concepts", ["view"]),
      ...some("quote_templates", ["view"]),
      ...all("quotes"),
      ...all("direct_orders"),
      ...some("production", ["view"]),
      ...some("inventory", ["view", "view_cost"]),
      ...all("purchase_orders"),
      ...all("reports"),
    ],
  },
  {
    name: "Ventas",
    description: "Gestion comercial de clientes, cotizaciones y ordenes.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("clients", ["view", "create", "edit", "export"]),
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
      ...some("suppliers", ["view"]),
      ...some("issuing_companies", ["view"]),
      ...some("manufacturing_processes", ["view"]),
      ...some("installation_concepts", ["view"]),
      ...some("quote_templates", ["view", "create", "edit"]),
      ...some("quotes", [
        "view",
        "create",
        "edit",
        "delete_draft",
        "submit",
        "print",
        "view_cost",
        "view_benefit",
        "cancel",
      ]),
      ...some("direct_orders", [
        "view",
        "create",
        "edit",
        "delete_draft",
        "submit",
        "cancel",
        "convert_to_quote",
      ]),
      ...some("production", ["view"]),
      ...some("reports", ["quotations_pdf"]),
    ],
  },
  {
    name: "Produccion",
    description: "Seguimiento y avance de ordenes de produccion.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
      ...some("warehouses", ["view"]),
      ...some("quotes", ["view"]),
      ...some("direct_orders", ["view"]),
      ...all("production"),
      ...some("inventory", ["view"]),
      ...some("purchase_orders", ["view"]),
      ...some("reports", ["production_pdf"]),
    ],
  },
  {
    name: "Compras",
    description: "Gestion de proveedores, ordenes de compra y recepciones.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("suppliers", ["view", "create", "edit", "export"]),
      ...some("items", ["view"]),
      ...some("categories", ["view"]),
      ...some("warehouses", ["view"]),
      ...some("quotes", ["view", "view_cost"]),
      ...some("production", ["view"]),
      ...some("inventory", ["view"]),
      ...some("purchase_orders", [
        "view",
        "create",
        "edit",
        "submit",
        "reject",
        "cancel",
        "receive",
        "print",
      ]),
      ...some("reports", ["purchases_pdf"]),
    ],
  },
  {
    name: "Almacen",
    description: "Gestion de almacenes, inventario y transferencias.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...all("warehouses"),
      ...all("categories"),
      ...some("items", ["view", "create", "edit", "export"]),
      ...some("production", ["view"]),
      ...all("inventory"),
      ...some("purchase_orders", ["view", "receive"]),
      ...some("reports", ["inventory_pdf"]),
    ],
  },
  {
    name: "Administracion",
    description: "Consulta administrativa y catalogos base.",
    isSystem: true,
    permissions: [
      "dashboard.view",
      ...some("users", ["view"]),
      ...some("clients", ["view", "export"]),
      ...some("suppliers", ["view", "export"]),
      ...some("items", ["view"]),
      ...some("audit", ["view"]),
      ...some("issuing_companies", ["view", "create", "edit", "manage"]),
      ...some("manufacturing_processes", ["view", "create", "edit", "delete"]),
      ...some("installation_concepts", ["view", "create", "edit", "delete"]),
      ...some("quotes", ["view", "print"]),
      ...some("direct_orders", ["view"]),
      ...some("production", ["view"]),
      ...some("inventory", ["view"]),
      ...some("purchase_orders", ["view", "print"]),
      ...all("reports"),
    ],
  },
];
