"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// Etiquetas legibles por segmento de ruta.
const LABELS = {
  "": "Inicio",
  usuarios: "Usuarios",
  roles: "Roles y permisos",
  bitacora: "Bitacora",
  clientes: "Clientes",
  proveedores: "Proveedores",
  catalogos: "Catalogos",
  almacenes: "Almacenes",
  categorias: "Categorias",
  productos: "Productos e insumos",
  nuevo: "Nuevo",
  editar: "Editar",
};

function labelFor(segment) {
  if (LABELS[segment]) return LABELS[segment];
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = [{ href: "/", label: "Inicio" }];
  let acc = "";
  for (const segment of segments) {
    acc += `/${segment}`;
    crumbs.push({ href: acc, label: labelFor(segment) });
  }

  return (
    <nav aria-label="Ruta" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.href}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-content-muted" aria-hidden />
            )}
            {isLast ? (
              <span className="font-medium text-content">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-content-muted hover:text-content"
              >
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
