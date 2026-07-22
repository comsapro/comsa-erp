// Configuracion del menu lateral. Cada item declara el permiso requerido.
// El menu se filtra en el servidor segun los permisos efectivos del usuario.

export const NAV_SECTIONS = [
  {
    id: "general",
    label: null,
    items: [{ label: "Inicio", href: "/", icon: "LayoutDashboard", permission: "dashboard.view" }],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { label: "Cotizaciones", href: "/cotizaciones", icon: "FileText", permission: "quotes.view" },
      { label: "Ordenes directas", href: "/ordenes-directas", icon: "ClipboardList", permission: "direct_orders.view" },
      { label: "Biblioteca de items", href: "/biblioteca-items", icon: "Library", permission: "quote_templates.view" },
    ],
  },
  {
    id: "produccion",
    label: "Produccion",
    items: [
      { label: "Ordenes de produccion", href: "/produccion", icon: "Factory", permission: "production.view" },
    ],
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
      { label: "Empresas emisoras", href: "/empresas-emisoras", icon: "Building2", permission: "issuing_companies.view" },
      { label: "Procesos", href: "/procesos", icon: "Cog", permission: "manufacturing_processes.view" },
      { label: "Instalaciones", href: "/instalaciones", icon: "Wrench", permission: "installation_concepts.view" },
      { label: "Almacenes", href: "/catalogos/almacenes", icon: "Warehouse", permission: "warehouses.view" },
      { label: "Categorias", href: "/catalogos/categorias", icon: "FolderTree", permission: "categories.view" },
      { label: "Productos e insumos", href: "/catalogos/productos", icon: "Package", permission: "items.view" },
    ],
  },
];

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
