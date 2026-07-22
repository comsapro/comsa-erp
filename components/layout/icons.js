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
  FileText,
  ClipboardList,
  Library,
  Factory,
  Building2,
  Cog,
  Wrench,
} from "lucide-react";

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
  FileText,
  ClipboardList,
  Library,
  Factory,
  Building2,
  Cog,
  Wrench,
};

export function getIcon(name) {
  return ICONS[name] || Boxes;
}
