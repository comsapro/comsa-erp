import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Contact,
  Truck,
  Warehouse,
  FolderTree,
  Package,
  Boxes,
} from "lucide-react";

// Mapa de nombres de icono (definidos en la config del menu) a componentes.
export const ICONS = {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Contact,
  Truck,
  Warehouse,
  FolderTree,
  Package,
  Boxes,
};

export function getIcon(name) {
  return ICONS[name] || Boxes;
}
