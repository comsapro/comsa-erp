// Configuracion del menu lateral. Cada item declara el permiso requerido.
// El menu se filtra en el servidor segun los permisos efectivos del usuario.

export const NAV_SECTIONS = [
  {
    id: "general",
    label: null,
    items: [{ label: "Inicio", href: "/", icon: "LayoutDashboard", permission: "dashboard.view" }],
  },
  {
    id: "administracion",
    label: "Administracion",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: "Users", permission: "users.view" },
      { label: "Roles y permisos", href: "/roles", icon: "ShieldCheck", permission: "roles.view" },
      { label: "Bitacora", href: "/bitacora", icon: "ScrollText", permission: "audit.view" },
    ],
  },
  {
    id: "catalogos",
    label: "Catalogos",
    items: [
      { label: "Clientes", href: "/clientes", icon: "Contact", permission: "clients.view" },
      { label: "Proveedores", href: "/proveedores", icon: "Truck", permission: "suppliers.view" },
      { label: "Almacenes", href: "/catalogos/almacenes", icon: "Warehouse", permission: "warehouses.view" },
      { label: "Categorias", href: "/catalogos/categorias", icon: "FolderTree", permission: "categories.view" },
      { label: "Productos e insumos", href: "/catalogos/productos", icon: "Package", permission: "items.view" },
    ],
  },
];

// Devuelve solo las secciones e items para los que el usuario tiene permiso.
export function buildMenu(permissions = []) {
  const set = new Set(permissions);
  const sections = [];
  for (const section of NAV_SECTIONS) {
    const items = section.items.filter(
      (item) => !item.permission || set.has(item.permission)
    );
    if (items.length > 0) {
      sections.push({ ...section, items });
    }
  }
  return sections;
}
