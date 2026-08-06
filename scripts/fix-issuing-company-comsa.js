/**
 * Reasigna cotizaciones de la empresa emisora de prueba (Juan Carlos)
 * a COMSA y desactiva el registro incorrecto.
 *
 * Uso: node --env-file=.env scripts/fix-issuing-company-comsa.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BAD_ID = "cmrxkh6q60000uhmwecng2bwx";
const COMSA_ID = "cms50sv5p0000l604ezcd3otc";

async function main() {
  const comsa = await prisma.issuingCompany.findFirst({
    where: { id: COMSA_ID, deletedAt: null },
  });
  if (!comsa) throw new Error("Empresa COMSA no encontrada");

  // Normalizar datos fiscales COMSA
  await prisma.issuingCompany.update({
    where: { id: COMSA_ID },
    data: {
      commercialName: "COMSA",
      legalName:
        "COMERCIALIZADORA, OPERACIONES Y MANUFACTURA, S.A. DE C.V.",
      rfc: comsa.rfc || "COM070417GW6",
      email: comsa.email || "comsamaquinados@comsapro.com.mx",
      phone: comsa.phone || "8715385508",
      status: "ACTIVE",
    },
  });

  const quotes = await prisma.quote.updateMany({
    where: { issuingCompanyId: BAD_ID },
    data: { issuingCompanyId: COMSA_ID },
  });
  const orders = await prisma.directOrder.updateMany({
    where: { issuingCompanyId: BAD_ID },
    data: { issuingCompanyId: COMSA_ID },
  });

  await prisma.issuingCompany.update({
    where: { id: BAD_ID },
    data: {
      status: "INACTIVE",
      deletedAt: new Date(),
      commercialName: "Juan Carlos (desactivado)",
    },
  });

  console.log({
    quotesReassigned: quotes.count,
    directOrdersReassigned: orders.count,
    comsaId: COMSA_ID,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
