import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password.js";
import {
  buildPermissionList,
  ALL_PERMISSION_CODES,
  SYSTEM_ROLES,
} from "../lib/permissions/catalog.js";

const prisma = new PrismaClient();

async function seedPermissions() {
  const permissions = buildPermissionList();
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  console.log(`  Permisos: ${permissions.length}`);
  return prisma.permission.findMany();
}

async function seedRoles(allPermissions) {
  const byCode = new Map(allPermissions.map((p) => [p.code, p]));

  for (const role of SYSTEM_ROLES) {
    const codes =
      role.permissions === "ALL" ? ALL_PERMISSION_CODES : role.permissions;

    const dbRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });

    // Reasignar permisos del rol (fuente de verdad = catalogo).
    await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
    const rows = codes
      .map((code) => byCode.get(code))
      .filter(Boolean)
      .map((perm) => ({ roleId: dbRole.id, permissionId: perm.id }));

    if (rows.length > 0) {
      await prisma.rolePermission.createMany({
        data: rows,
        skipDuplicates: true,
      });
    }
    console.log(`  Rol: ${role.name} (${rows.length} permisos)`);
  }
}

async function seedAdmin() {
  const name = process.env.SEED_ADMIN_NAME || "Administrador COMSA";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@comsa.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    console.warn(
      "  SEED_ADMIN_PASSWORD no definido; se omite la creacion del administrador."
    );
    return;
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: "Administrador" },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  Administrador ya existe: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: true,
    },
  });

  if (adminRole) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });
  }
  console.log(`  Administrador creado: ${email}`);
}

async function seedHolidays() {
  const year = new Date().getFullYear();
  const holidays = [
    { date: new Date(Date.UTC(year, 0, 1)), name: "Año Nuevo" },
    { date: new Date(Date.UTC(year, 1, 5)), name: "Día de la Constitución" },
    { date: new Date(Date.UTC(year, 2, 16)), name: "Natalicio de Benito Juárez" },
    { date: new Date(Date.UTC(year, 4, 1)), name: "Día del Trabajo" },
    { date: new Date(Date.UTC(year, 8, 16)), name: "Independencia de México" },
    { date: new Date(Date.UTC(year, 10, 2)), name: "Día de Muertos / Revolución" },
    { date: new Date(Date.UTC(year, 11, 25)), name: "Navidad" },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { name: h.name },
      create: h,
    });
  }
  console.log(`  Festivos: ${holidays.length} (${year})`);
}

async function main() {
  console.log("Seeding COMSA ERP...");
  const permissions = await seedPermissions();
  await seedRoles(permissions);
  await seedAdmin();
  await seedHolidays();
  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
