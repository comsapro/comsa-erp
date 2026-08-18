import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions/require-permission";
import { getActor } from "@/lib/api/actor";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/logger";
import { jsonOk } from "@/lib/api/http";
import { handicapSchema } from "./schemas";
import { expectedHoursFromQuoted, canRecalcExpectedHours } from "./handicap";

export async function getProductionSettings(request) {
  await requirePermission("production.view");
  const row =
    (await prisma.productionSetting.findUnique({ where: { id: "default" } })) ||
    (await prisma.productionSetting.create({
      data: { id: "default", handicapPercent: 0 },
    }));
  return jsonOk({
    handicapPercent: Number(row.handicapPercent) || 0,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  });
}

export async function updateProductionSettings(request) {
  await requirePermission("production.manage_handicap");
  const actor = await getActor(request);
  const data = handicapSchema.parse(await request.json());
  const percent = new Prisma.Decimal(data.handicapPercent);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.productionSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        handicapPercent: percent,
        updatedBy: actor.id,
      },
      update: { handicapPercent: percent, updatedBy: actor.id },
    });

    if (data.applyToPending) {
      const pending = await tx.productionItemProcess.findMany({
        where: { status: "PENDING" },
        include: { sessions: { take: 1 } },
      });
      for (const process of pending) {
        if (!canRecalcExpectedHours(process)) continue;
        if (process.sourceType !== "QUOTATION") continue;
        const next = expectedHoursFromQuoted(
          process.quotedHours,
          data.handicapPercent
        );
        await tx.productionItemProcess.update({
          where: { id: process.id },
          data: {
            expectedHours: new Prisma.Decimal(next),
            handicapSnapshot: percent,
            updatedBy: actor.id,
          },
        });
      }
    }
    return updated;
  });

  await recordAudit({
    actor,
    module: "production",
    entity: "ProductionSetting",
    entityId: "default",
    action: AUDIT_ACTIONS.UPDATE,
    newData: { handicapPercent: data.handicapPercent },
  });

  return jsonOk({
    handicapPercent: Number(row.handicapPercent) || 0,
    updatedAt: row.updatedAt,
  });
}
