/**
 * Importa usuarios del dump MySQL legado (tabla `usuarios`).
 * Password generico: Comsa2026!
 * No envia correos.
 *
 * Uso:
 *   node --env-file=.env prisma/import-legacy-users.js
 *   LEGACY_DUMP_PATH="C:/ruta/dump.sql" npm run db:seed:legacy-users
 *
 * Idempotente por email. Actualiza nombre, estatus, roles y password.
 */

import { PrismaClient } from "@prisma/client";
import { extractTablesFromDump } from "../scripts/mysql-dump-parser.js";
import { phpUnserialize } from "../scripts/php-unserialize.js";
import { hashPassword } from "../lib/auth/password.js";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
  log: ["warn", "error"],
});

const DEFAULT_DUMP =
  process.env.LEGACY_DUMP_PATH ||
  "c:/Users/juanc/Downloads/comsa_2026-07-09.sql/comsa_2026-07-09.sql";

const GENERIC_PASSWORD = process.env.LEGACY_USER_PASSWORD || "Comsa2026!";

function cleanText(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function cleanEmail(value) {
  const s = cleanText(value);
  if (!s || !s.includes("@")) return null;
  return s.toLowerCase();
}

function displayName(nombre, email) {
  const raw = cleanText(nombre);
  if (!raw) return email;
  return raw.replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim();
}

function permissionKeys(permisos) {
  if (!permisos || permisos === "0") return [];
  const parsed = phpUnserialize(permisos);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.keys(parsed).filter((k) => parsed[k] === "1" || parsed[k] === 1);
}

function mapRoleNames(row, keys) {
  if (String(row.master) === "1") return ["Administrador"];
  const has = (...names) => names.some((n) => keys.includes(n));
  const roles = [];

  if (
    has(
      "cotizacionesSupervisor",
      "comsaOCSupervisor",
      "comsaSCSupervisor",
      "comsaValesSupervisor"
    )
  ) {
    roles.push("Supervisor");
  }
  if (has("cotizaciones", "cotizacionesSin", "cotizacionesUtilidades")) {
    roles.push("Ventas");
  }
  if (
    has(
      "produccion",
      "produccionSin",
      "produccionPartidas",
      "produccionSort",
      "comsaProcesos"
    )
  ) {
    roles.push("Produccion");
  }
  if (
    has(
      "almacenes",
      "almacenesExistencias",
      "almacenesTransfers",
      "almacenesTarjeta",
      "almacenesControlHerramientas",
      "almacenesConsignacionInsumos"
    )
  ) {
    roles.push("Almacen");
  }
  if (
    has(
      "comsaOC",
      "proveedores",
      "comsaRecepcionMateriales",
      "comsaSC",
      "comsaVales"
    )
  ) {
    roles.push("Compras");
  }
  if (
    has(
      "clientes",
      "colaboradores",
      "personal",
      "equipos",
      "presets",
      "itemsCategorias",
      "itemsProductos",
      "itemsConsumibles"
    )
  ) {
    roles.push("Administracion");
  }

  if (!roles.length) roles.push("Ventas");
  return [...new Set(roles)];
}

async function main() {
  const dumpPath = DEFAULT_DUMP;
  console.log(`Importando usuarios legado desde:\n  ${dumpPath}\n`);
  console.log("Password generico: Comsa2026! (sin envio de correo)\n");

  const { usuarios = [] } = await extractTablesFromDump(dumpPath, ["usuarios"]);
  console.log(`Filas en dump: ${usuarios.length}`);

  const roles = await prisma.role.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));
  if (!roleByName.size) {
    throw new Error("No hay roles. Ejecuta primero `npm run db:seed`.");
  }

  const passwordHash = await hashPassword(GENERIC_PASSWORD);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of usuarios) {
    const email = cleanEmail(row.usr);
    if (!email) {
      skipped += 1;
      console.log(`  skip id=${row.id} (sin email)`);
      continue;
    }

    const name = displayName(row.nombre, email);
    const status = String(row.status) === "1" ? "ACTIVE" : "INACTIVE";
    const keys = permissionKeys(row.permisos);
    const roleNames = mapRoleNames(row, keys);
    const roleIds = roleNames
      .map((n) => roleByName.get(n))
      .filter(Boolean);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          status,
          mustChangePassword: true,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
      });
      created += 1;
      console.log(
        `  + ${email} · ${name} · ${status} · ${roleNames.join(", ")} · id=${user.id}`
      );
      continue;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          status,
          mustChangePassword: true,
          deletedAt: null,
        },
      }),
      prisma.userRole.deleteMany({ where: { userId: existing.id } }),
      prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: existing.id, roleId })),
        skipDuplicates: true,
      }),
    ]);
    updated += 1;
    console.log(
      `  ~ ${email} · ${name} · ${status} · ${roleNames.join(", ")}`
    );
  }

  console.log(
    `\nListo. creados=${created} actualizados=${updated} omitidos=${skipped}`
  );
}

main()
  .catch((err) => {
    console.error("\nError importando usuarios:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
