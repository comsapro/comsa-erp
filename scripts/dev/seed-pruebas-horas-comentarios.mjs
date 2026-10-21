import { PrismaClient } from "@prisma/client";

const FOLIO_HOURS = "PRB-HORAS";
const FOLIO_HOURS_DO = "PRB-HORAS-OD";
const FOLIO_HOURS_OP = "PRB-HORAS-OP";
const FOLIO_CMT = "PRB-CMT";

const PHRASE = "Las piezas seran fabricadas en acero inox 304";
const COMMENT_1 = `PARTIDA 1. ${PHRASE}. `.repeat(6).trim();
const COMMENT_2 = `PARTIDA 2. Este comentario es mas largo y debe imprimirse completo bajo la partida 2. ${PHRASE}. `.repeat(12).trim();

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function removeQuoteGraph(prisma, folio) {
  const quote = await prisma.quote.findUnique({ where: { folio } });
  if (!quote) return;
  const productionId = quote.productionOrderId;
  const directId = quote.directOrderId;
  await prisma.quote.update({
    where: { id: quote.id },
    data: { productionOrderId: null, directOrderId: null },
  });
  if (directId) {
    await prisma.directOrder.update({
      where: { id: directId },
      data: { productionOrderId: null },
    });
  }
  if (productionId) {
    await prisma.productionOrder.delete({ where: { id: productionId } });
  }
  if (directId) {
    await prisma.directOrder.delete({ where: { id: directId } });
  }
  await prisma.quote.delete({ where: { id: quote.id } });
}

async function main() {
  const prisma = new PrismaClient();
  const client = await prisma.client.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    include: { contacts: { take: 1 } },
    orderBy: { commercialName: "asc" },
  });
  const company = await prisma.issuingCompany.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { commercialName: "asc" },
  });
  const user = await prisma.user.findFirst({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!client || !company || !user) {
    throw new Error("Falta un cliente, una empresa emisora o un usuario activo");
  }

  await removeQuoteGraph(prisma, FOLIO_HOURS);
  await removeQuoteGraph(prisma, FOLIO_CMT);
  const leftoverOrder = await prisma.directOrder.findUnique({
    where: { folio: FOLIO_HOURS_DO },
  });
  if (leftoverOrder) {
    await prisma.directOrder.delete({ where: { id: leftoverOrder.id } });
  }
  const leftoverOp = await prisma.productionOrder.findUnique({
    where: { folio: FOLIO_HOURS_OP },
  });
  if (leftoverOp) {
    await prisma.productionOrder.delete({ where: { id: leftoverOp.id } });
  }

  const issued = today();
  const validUntil = addDays(issued, 30);
  const contactId = client.contacts[0]?.id || null;

  const hoursQuote = await prisma.quote.create({
    data: {
      folio: FOLIO_HOURS,
      version: "A",
      clientId: client.id,
      clientContactId: contactId,
      sellerId: user.id,
      issuingCompanyId: company.id,
      orderType: "DIRECT_ORDER_REFERENCE",
      currency: "MXN",
      elaborationDate: issued,
      requestDate: issued,
      validUntil,
      requisition: "PRB-HORAS",
      status: "PENDING_APPROVAL",
      priceAfterProduction: true,
      subtotal: 0,
      taxTotal: 0,
      total: 0,
      createdBy: user.id,
      updatedBy: user.id,
      items: {
        create: {
          position: 1,
          description: "Prueba de horas de produccion",
          quantity: 2,
          unit: "PZA",
          deliveryTimeMin: 10,
          deliveryTimeMax: 15,
          deliveryTimeUnit: "DAY",
          benefitPercentage: 30,
          clientObservations: "Las horas de manufactura deben salir de produccion al aprobar.",
          manufacturing: {
            create: [
              {
                processNameSnapshot: "Balanceo en Campo",
                unitSnapshot: "HOUR",
                quantity: 0,
                unitRate: 900,
                amount: 0,
                sortOrder: 0,
              },
              {
                processNameSnapshot: "CORTE GUILLOTINA",
                unitSnapshot: "HOUR",
                quantity: 0,
                unitRate: 95,
                amount: 0,
                sortOrder: 1,
              },
            ],
          },
        },
      },
    },
    include: { items: { include: { manufacturing: { orderBy: { sortOrder: "asc" } } } } },
  });

  const item = hoursQuote.items[0];
  const [balanceo, corte] = item.manufacturing;

  const production = await prisma.productionOrder.create({
    data: {
      folio: FOLIO_HOURS_OP,
      sourceType: "DIRECT_ORDER",
      clientId: client.id,
      quoteId: hoursQuote.id,
      approvalDate: issued,
      status: "COMPLETED",
      completedAt: new Date(),
      totalItems: 1,
      completedItems: 1,
      progressPercentage: 100,
      createdBy: user.id,
      updatedBy: user.id,
      items: {
        create: {
          sourceItemId: item.id,
          sourceItemType: "QUOTE_ITEM",
          position: 1,
          description: item.description,
          quantity: 2,
          status: "COMPLETED",
          completedAt: new Date(),
          processes: {
            create: [
              {
                sourceType: "QUOTATION",
                quotedManufacturingId: balanceo.id,
                processNameSnapshot: "Balanceo en Campo",
                unitSnapshot: "HOUR",
                quotedHours: 0,
                expectedHours: 0,
                realHours: 6,
                status: "COMPLETED",
                completedAt: new Date(),
                sortOrder: 0,
                createdBy: user.id,
                updatedBy: user.id,
              },
              {
                sourceType: "QUOTATION",
                quotedManufacturingId: corte.id,
                processNameSnapshot: "CORTE GUILLOTINA",
                unitSnapshot: "HOUR",
                quotedHours: 0,
                expectedHours: 0,
                realHours: 0,
                status: "COMPLETED",
                completedAt: new Date(),
                sortOrder: 1,
                createdBy: user.id,
                updatedBy: user.id,
              },
            ],
          },
        },
      },
    },
    include: { items: true },
  });

  const corteProcess = await prisma.productionItemProcess.findFirst({
    where: {
      quotedManufacturingId: corte.id,
      productionItem: { productionOrderId: production.id },
    },
  });
  const started = new Date(Date.now() - 4 * 60 * 60 * 1000);
  await prisma.productionTimeSession.create({
    data: {
      productionOrderId: production.id,
      productionItemId: production.items[0].id,
      processId: corteProcess.id,
      userId: user.id,
      status: "CLOSED",
      startedAt: started,
      endedAt: new Date(),
      lastResumedAt: started,
      accumulatedMinutes: 240,
      durationMinutes: 240,
    },
  });

  const directOrder = await prisma.directOrder.create({
    data: {
      folio: FOLIO_HOURS_DO,
      orderType: "GENERAL",
      clientId: client.id,
      clientContactId: contactId,
      sellerId: user.id,
      issuingCompanyId: company.id,
      requestDate: issued,
      validUntil,
      requisition: "PRB-HORAS",
      status: "PENDING_APPROVAL",
      productionOrderId: production.id,
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await prisma.quote.update({
    where: { id: hoursQuote.id },
    data: {
      directOrderId: directOrder.id,
      productionOrderId: production.id,
    },
  });

  const commentsQuote = await prisma.quote.create({
    data: {
      folio: FOLIO_CMT,
      version: "A",
      clientId: client.id,
      clientContactId: contactId,
      sellerId: user.id,
      issuingCompanyId: company.id,
      orderType: "GENERAL",
      currency: "MXN",
      elaborationDate: issued,
      requestDate: issued,
      validUntil,
      requisition: "PRB-CMT",
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: user.id,
      subtotal: 426250,
      taxTotal: 68200,
      total: 494450,
      createdBy: user.id,
      updatedBy: user.id,
      items: {
        create: [
          {
            position: 1,
            description: "Prueba del dia 21.10.2026",
            quantity: 15,
            unit: "PZA",
            deliveryTimeMin: 15,
            deliveryTimeMax: 20,
            deliveryTimeUnit: "DAY",
            benefitPercentage: 30,
            unitSalePrice: 17050,
            saleSubtotal: 255750,
            clientObservations: COMMENT_1,
            internalObservations: "Nota interna de la partida 1. No debe salir en el PDF.",
          },
          {
            position: 2,
            description: "Prueba del dia 21.10.2026",
            quantity: 10,
            unit: "PZA",
            deliveryTimeMin: 15,
            deliveryTimeMax: 20,
            deliveryTimeUnit: "DAY",
            benefitPercentage: 30,
            unitSalePrice: 17050,
            saleSubtotal: 170500,
            clientObservations: COMMENT_2,
            internalObservations: "Nota interna de la partida 2. No debe salir en el PDF.",
          },
        ],
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        client: client.commercialName,
        hours: {
          quote: FOLIO_HOURS,
          quoteId: hoursQuote.id,
          directOrder: FOLIO_HOURS_DO,
          production: FOLIO_HOURS_OP,
          pieces: 2,
          expectedAfterApprove: {
            "Balanceo en Campo": "6 h totales → 3 h por pieza",
            "CORTE GUILLOTINA": "4 h de cronometro → 2 h por pieza",
          },
        },
        comments: {
          quote: FOLIO_CMT,
          quoteId: commentsQuote.id,
          item1Chars: COMMENT_1.length,
          item2Chars: COMMENT_2.length,
        },
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
