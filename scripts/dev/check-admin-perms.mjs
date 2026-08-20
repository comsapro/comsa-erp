import { PrismaClient } from "@prisma/client";
import { ALL_PERMISSION_CODES } from "../../lib/permissions/catalog.js";

const prisma = new PrismaClient();

const admin = await prisma.role.findFirst({
  where: { name: "Administrador" },
  include: { permissions: { include: { permission: true } } },
});

const adminCodes = new Set(admin?.permissions.map((rp) => rp.permission.code) || []);
const missing = ALL_PERMISSION_CODES.filter((c) => !adminCodes.has(c));

console.log("Admin permission count:", adminCodes.size);
console.log("Catalog permission count:", ALL_PERMISSION_CODES.length);
console.log("Missing from admin:", missing.length ? missing.join(", ") : "(none)");
console.log("production.print in DB:", await prisma.permission.findUnique({ where: { code: "production.print" } }) ? "yes" : "no");
console.log("Admin has production.print:", adminCodes.has("production.print") ? "yes" : "no");

await prisma.$disconnect();
