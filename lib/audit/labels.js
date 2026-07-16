// Etiquetas y tonos para las acciones de bitacora (usable en cliente).
export const AUDIT_ACTION_LABELS = {
  create: "Creacion",
  update: "Edicion",
  activate: "Activacion",
  deactivate: "Desactivacion",
  delete: "Eliminacion",
  approve: "Aprobacion",
  reject: "Rechazo",
  cancel: "Cancelacion",
  permissions_change: "Cambio de permisos",
  inventory_adjust: "Ajuste de inventario",
};

export const AUDIT_ACTION_TONES = {
  create: "success",
  update: "brand",
  activate: "success",
  deactivate: "warning",
  delete: "danger",
  permissions_change: "warning",
  inventory_adjust: "brand",
};

export const AUDIT_MODULE_LABELS = {
  users: "Usuarios",
  roles: "Roles y permisos",
  clients: "Clientes",
  suppliers: "Proveedores",
  warehouses: "Almacenes",
  categories: "Categorias",
  items: "Productos e insumos",
  audit: "Bitacora",
};

export const AUDIT_ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export const AUDIT_MODULE_OPTIONS = [
  { value: "", label: "Todos los modulos" },
  ...Object.entries(AUDIT_MODULE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];
