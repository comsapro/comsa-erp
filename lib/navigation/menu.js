// Configuracion del menu lateral. Cada item declara el permiso requerido.
// El menu se filtra en el servidor segun los permisos efectivos del usuario.

export const NAV_SECTIONS = [
  {
    id: "general",
    label: null,
    items: [
      { label: "Inicio", href: "/", icon: "LayoutDashboard", permission: "dashboard.view" },
      {
        label: "Dashboard ventas",
        href: "/ventas",
        icon: "Banknote",
        permission: "sales.view",
      },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      { label: "Cotizaciones", href: "/cotizaciones", icon: "FileText", permission: "quotes.view" },
      { label: "Ordenes directas", href: "/ordenes-directas", icon: "ClipboardList", permission: "direct_orders.view" },
      { label: "Biblioteca de items", href: "/biblioteca-items", icon: "Library", permission: "quote_templates.view" },
      { label: "Facturas ventas", href: "/ventas/facturas", icon: "Receipt", permission: "sales.create_invoice" },
      { label: "Metas de ventas", href: "/ventas/metas", icon: "Target", permission: "sales.manage_goals" },
      {
        label: "Calendario ventas",
        href: "/ventas/calendario",
        icon: "CalendarDays",
        permission: "sales.view",
      },
    ],
  },
  {
    id: "produccion",
    label: "Produccion",
    items: [
      { label: "Ordenes de produccion", href: "/produccion", icon: "Factory", permission: "production.view" },
      { label: "Tablero", href: "/produccion/tablero", icon: "LayoutDashboard", permission: "production.view" },
      { label: "Gantt", href: "/produccion/gantt", icon: "GanttChart", permission: "production.view" },
      { label: "Calendario", href: "/produccion/calendario", icon: "CalendarDays", permission: "production.view" },
    ],
  },
  {
    id: "calidad",
    label: "Calidad",
    items: [
      { label: "Bandeja pendiente", href: "/calidad", icon: "ClipboardCheck", permission: "quality.view" },
      { label: "Instrumentos", href: "/calidad/instrumentos", icon: "Ruler", permission: "quality.manage_instruments" },
      { label: "Alertas", href: "/calidad/alertas", icon: "Bell", permission: "quality.manage_alerts" },
      { label: "Historial", href: "/calidad/historial", icon: "History", permission: "quality.view_history" },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    items: [
      { label: "Existencias", href: "/inventario", icon: "Boxes", permission: "inventory.view" },
      { label: "Movimientos", href: "/inventario/movimientos", icon: "ArrowLeftRight", permission: "inventory.view" },
      { label: "Stock bajo", href: "/inventario/bajo-stock", icon: "AlertTriangle", permission: "inventory.view" },
      { label: "Transferencias", href: "/transferencias", icon: "Truck", permission: "inventory.transfer" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    items: [
      { label: "Ordenes de compra", href: "/ordenes-compra", icon: "ShoppingCart", permission: "purchase_orders.view" },
      { label: "Recepciones", href: "/recepciones", icon: "PackageCheck", permission: "purchase_orders.receive" },
    ],
  },
  // Reportes PDF ocultos temporalmente (fuera de alcance actual)
  {
    id: "administracion",
    label: "Administracion",
    items: [
      { label: "Usuarios", href: "/usuarios", icon: "Users", permission: "users.view" },
      { label: "Roles y permisos", href: "/roles", icon: "ShieldCheck", permission: "roles.view" },
      { label: "Equipos", href: "/equipos", icon: "UsersRound", permission: "teams.view" },
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
    const items = section.items.filter((item) => {
      if (item.anyOf?.length) {
        return item.anyOf.some((code) => set.has(code));
      }
      return !item.permission || set.has(item.permission);
    });
    if (items.length > 0) {
      sections.push({ ...section, items });
    }
  }
  return sections;
}
