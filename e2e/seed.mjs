import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password.js";
import {
  calculateQuoteHeaderTotals,
  calculateQuoteItemTotals,
  persistedQuoteItemTotals,
} from "../lib/quotes/calculations.js";
import {
  COMMENT_TOKEN,
  E2E_PASSWORD,
  FOLIOS,
  INVOICE_NUMBER,
  LONG_COMMENT,
  USERS,
} from "./constants.js";
import { assertE2eDatabase, e2eEnv, projectRoot } from "./env.js";

const root = projectRoot();
const authDir = path.join(root, "e2e", ".auth");

function today() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function upsertUser(prisma, { name, email, roleName }, passwordHash) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Rol no encontrado: ${roleName}`);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: false,
      deletedAt: null,
    },
    create: {
      name,
      email,
      passwordHash,
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
}

async function createQuoteWithItem(prisma, {
  folio,
  status,
  sellerId,
  clientId,
  contactId,
  issuingCompanyId,
  processId,
  itemId,
  supplierId,
  actorId,
  quantity,
  comments,
  extraAmount = 500,
}) {
  const totals = calculateQuoteItemTotals({
    manufacturing: [{ amount: 12500 }],
    materials: [{ amount: 3000 }],
    extras: extraAmount ? [{ amount: extraAmount }] : [],
    benefitPercentage: 30,
    quantity,
  });
  const header = calculateQuoteHeaderTotals([totals]);
  const elaborationDate = today();
  return prisma.quote.create({
    data: {
      folio,
      clientId,
      clientContactId: contactId,
      sellerId,
      issuingCompanyId,
      orderType: "GENERAL",
      currency: "MXN",
      elaborationDate,
      requestDate: elaborationDate,
      validUntil: addDays(elaborationDate, 30),
      status,
      ...header,
      createdBy: actorId,
      updatedBy: actorId,
      items: {
        create: {
          position: 1,
          description: `Pieza ${folio}`,
          quantity,
          unit: "PZA",
          benefitPercentage: 30,
          clientObservations: comments || null,
          ...persistedQuoteItemTotals(totals),
          manufacturing: {
            create: {
              manufacturingProcessId: processId,
              processNameSnapshot: "CORTE LASER",
              unitSnapshot: "HOUR",
              quantity: 1,
              unitRate: 12500,
              amount: 12500,
            },
          },
          materials: {
            create: {
              itemId,
              supplierId: supplierId || null,
              descriptionSnapshot: "Placa E2E",
              unit: "PZA",
              quantity: 1,
              unitPrice: 3000,
              amount: 3000,
            },
          },
          extras: extraAmount
            ? {
                create: {
                  description: "Tratamiento",
                  quantity: 1,
                  unit: "PZA",
                  unitPrice: extraAmount,
                  amount: extraAmount,
                },
              }
            : undefined,
        },
      },
    },
    include: { items: { include: { materials: true, manufacturing: true } } },
  });
}

export async function seedE2e() {
  const env = e2eEnv();
  Object.assign(process.env, env);
  assertE2eDatabase(process.env.DATABASE_URL);

  const { seedPermissions, seedRoles, seedHolidays } = await import("../prisma/seed.js");
  await seedPermissions().then((permissions) => seedRoles(permissions));
  await seedHolidays();

  const prisma = new PrismaClient();
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const users = {};
  for (const [key, spec] of Object.entries(USERS)) {
    users[key] = await upsertUser(
      prisma,
      { name: spec.name, email: spec.email, roleName: spec.role },
      passwordHash
    );
  }

  const client = await prisma.client.create({
    data: {
      commercialName: "Cliente E2E",
      legalName: "Cliente E2E SA de CV",
      rfc: "E2E010101AAA",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
      contacts: {
        create: { name: "Contacto E2E", isPrimary: true },
      },
    },
    include: { contacts: true },
  });
  const contact = client.contacts[0];

  const issuingCompany = await prisma.issuingCompany.create({
    data: {
      commercialName: "COMSA E2E",
      legalName: "COMSA E2E SA de CV",
      rfc: "CME010101BBB",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });

  const paloma = await prisma.supplier.create({
    data: {
      name: "La Paloma",
      legalName: "La Paloma SA",
      rfc: "PAL990101BBB",
      supplierType: "PRODUCTS",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });
  const amil = await prisma.supplier.create({
    data: {
      name: "Aceros Amil",
      legalName: "Aceros Amil SA",
      rfc: "AAM010101AAA",
      supplierType: "PRODUCTS",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });
  await prisma.supplier.create({
    data: {
      name: "Distribuidora Norte",
      rfc: "DNO010101CCC",
      supplierType: "PRODUCTS",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });

  const process = await prisma.manufacturingProcess.create({
    data: {
      code: "E2E-CORTE",
      name: "CORTE LASER",
      unit: "HOUR",
      defaultRate: 12500,
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });

  const catalogItem = await prisma.item.create({
    data: {
      sku: "E2E-PLA",
      name: "Placa E2E",
      itemType: "RAW_MATERIAL",
      unitOfMeasure: "PZA",
      status: "ACTIVE",
      createdBy: users.admin.id,
      updatedBy: users.admin.id,
    },
  });

  const quoteArgs = {
    sellerId: users.ventas.id,
    clientId: client.id,
    contactId: contact.id,
    issuingCompanyId: issuingCompany.id,
    processId: process.id,
    itemId: catalogItem.id,
    actorId: users.ventas.id,
  };

  const qtyQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.qtyQuote,
    status: "DRAFT",
    supplierId: paloma.id,
    quantity: 15,
  });

  const commentQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.commentQuote,
    status: "APPROVED",
    supplierId: paloma.id,
    quantity: 2,
    comments: LONG_COMMENT,
  });

  const searchQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.searchQuote,
    status: "DRAFT",
    supplierId: null,
    quantity: 1,
    extraAmount: 0,
  });

  const prodQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.prodQuote,
    status: "IN_PRODUCTION",
    supplierId: paloma.id,
    quantity: 15,
  });
  const prodItem = prodQuote.items[0];

  const production = await prisma.productionOrder.create({
    data: {
      folio: FOLIOS.production,
      sourceType: "QUOTE",
      clientId: client.id,
      quoteId: prodQuote.id,
      approvalDate: today(),
      status: "PENDING",
      totalItems: 1,
      createdBy: users.supervisor.id,
      updatedBy: users.supervisor.id,
      items: {
        create: {
          sourceItemId: prodItem.id,
          sourceItemType: "QUOTE_ITEM",
          position: 1,
          description: prodItem.description,
          quantity: 15,
          status: "PENDING",
          processes: {
            create: {
              sourceType: "QUOTATION",
              manufacturingProcessId: process.id,
              processNameSnapshot: "CORTE LASER",
              unitSnapshot: "HOUR",
              quotedHours: 1,
              expectedHours: 1,
              sortOrder: 0,
              createdBy: users.supervisor.id,
              updatedBy: users.supervisor.id,
            },
          },
        },
      },
    },
    include: { items: true },
  });
  await prisma.quote.update({
    where: { id: prodQuote.id },
    data: { productionOrderId: production.id },
  });

  const pendingPo = await prisma.purchaseOrder.create({
    data: {
      folio: FOLIOS.pendingPo,
      productionOrderId: production.id,
      quoteId: prodQuote.id,
      supplierId: paloma.id,
      requestedBy: users.compras.id,
      requestDate: today(),
      status: "PENDING_APPROVAL",
      subtotal: 45000,
      tax: 7200,
      total: 52200,
      createdBy: users.compras.id,
      updatedBy: users.compras.id,
      items: {
        create: {
          itemId: catalogItem.id,
          descriptionSnapshot: "Placa E2E",
          quantity: 15,
          unit: "PZA",
          supplierName: paloma.name,
          unitPrice: 3000,
          subtotal: 45000,
          taxAmount: 7200,
          total: 52200,
          sourceType: "QUOTE_MATERIAL",
          sourceMaterialId: prodItem.materials[0].id,
        },
      },
    },
  });

  const directOrder = await prisma.directOrder.create({
    data: {
      folio: FOLIOS.directOrder,
      orderType: "GENERAL",
      clientId: client.id,
      clientContactId: contact.id,
      sellerId: users.ventas.id,
      issuingCompanyId: issuingCompany.id,
      requestDate: today(),
      validUntil: addDays(today(), 30),
      status: "DRAFT",
      createdBy: users.ventas.id,
      updatedBy: users.ventas.id,
    },
  });
  const directQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.directQuote,
    status: "DRAFT",
    supplierId: paloma.id,
    quantity: 2,
  });
  await prisma.quote.update({
    where: { id: directQuote.id },
    data: { directOrderId: directOrder.id, priceAfterProduction: true },
  });

  const handbackQuote = await createQuoteWithItem(prisma, {
    ...quoteArgs,
    folio: FOLIOS.handbackQuote,
    status: "PENDING_APPROVAL",
    supplierId: paloma.id,
    quantity: 2,
  });
  const handbackProduction = await prisma.productionOrder.create({
    data: {
      folio: FOLIOS.handbackProduction,
      sourceType: "DIRECT_ORDER",
      clientId: client.id,
      quoteId: handbackQuote.id,
      approvalDate: today(),
      status: "COMPLETED",
      totalItems: 1,
      completedItems: 1,
      progressPercentage: 100,
      createdBy: users.supervisor.id,
      updatedBy: users.supervisor.id,
      items: {
        create: {
          sourceItemId: handbackQuote.items[0].id,
          sourceItemType: "QUOTE_ITEM",
          position: 1,
          description: handbackQuote.items[0].description,
          quantity: 2,
          status: "COMPLETED",
        },
      },
    },
  });
  const handbackOrder = await prisma.directOrder.create({
    data: {
      folio: FOLIOS.handbackOrder,
      orderType: "GENERAL",
      clientId: client.id,
      clientContactId: contact.id,
      sellerId: users.ventas.id,
      issuingCompanyId: issuingCompany.id,
      requestDate: today(),
      validUntil: addDays(today(), 30),
      status: "PENDING_APPROVAL",
      productionOrderId: handbackProduction.id,
      createdBy: users.ventas.id,
      updatedBy: users.ventas.id,
    },
  });
  await prisma.quote.update({
    where: { id: handbackQuote.id },
    data: {
      directOrderId: handbackOrder.id,
      productionOrderId: handbackProduction.id,
      priceAfterProduction: true,
      status: "PENDING_APPROVAL",
    },
  });

  const invoice = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: INVOICE_NUMBER,
      netAmount: 125000,
      invoiceDate: addDays(today(), -7),
      sellerId: users.ventas.id,
      clientPoNumber: "PO-E2E-1",
      receivedByClient: false,
      createdBy: users.ventas.id,
      updatedBy: users.ventas.id,
      quotes: {
        create: {
          quoteId: commentQuote.id,
          items: {
            create: { quoteItemId: commentQuote.items[0].id },
          },
        },
      },
    },
  });

  const ids = {
    ventasId: users.ventas.id,
    supervisorId: users.supervisor.id,
    comprasId: users.compras.id,
    qtyQuoteId: qtyQuote.id,
    commentQuoteId: commentQuote.id,
    searchQuoteId: searchQuote.id,
    prodQuoteId: prodQuote.id,
    productionId: production.id,
    productionItemId: production.items[0].id,
    pendingPoId: pendingPo.id,
    directOrderId: directOrder.id,
    directQuoteId: directQuote.id,
    handbackOrderId: handbackOrder.id,
    handbackQuoteId: handbackQuote.id,
    invoiceId: invoice.id,
    palomaId: paloma.id,
    amilId: amil.id,
    commentToken: COMMENT_TOKEN,
  };

  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, "ids.json"), JSON.stringify(ids, null, 2));
  await prisma.$disconnect();
  console.log("  Fixtures e2e listas:", Object.keys(ids).join(", "));
  return ids;
}

const invokedAsScript =
  process.argv[1] &&
  path.normalize(fileURLToPath(import.meta.url)) ===
    path.normalize(path.resolve(process.argv[1]));

if (invokedAsScript) {
  seedE2e().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
