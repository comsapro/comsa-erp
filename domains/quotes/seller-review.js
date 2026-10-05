import { ValidationError } from "../../lib/permissions/errors.js";

function near(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.001;
}

function isLocked(row, startedAt) {
  if (!row?.createdAt || !startedAt) return true;
  return new Date(row.createdAt).getTime() < new Date(startedAt).getTime();
}

function requireSame(label, ok) {
  if (!ok) {
    throw new ValidationError(
      `No se puede modificar lo ya capturado (${label})`
    );
  }
}

/**
 * En revision del vendedor solo se agregan procesos y extras.
 * Lo capturado antes de sellerReviewStartedAt no se edita ni se quita.
 */
export function assertSellerReviewEdit(existingItem, data, startedAt) {
  if (!data.id) {
    throw new ValidationError(
      "En la revision solo se pueden agregar cargos a partidas existentes"
    );
  }

  requireSame("descripcion", data.description === existingItem.description);
  requireSame("cantidad", near(data.quantity, existingItem.quantity));
  requireSame(
    "beneficio",
    near(data.benefitPercentage, existingItem.benefitPercentage)
  );
  requireSame(
    "descuento",
    near(data.discountPercentage, existingItem.discountPercentage)
  );

  assertLockedSubset(
    existingItem.manufacturing || [],
    data.manufacturing || [],
    startedAt,
    "proceso",
    (prev, next) =>
      prev.manufacturingProcessId === (next.manufacturingProcessId || null) &&
      near(prev.quantity, next.quantity) &&
      near(prev.unitRate, next.unitRate)
  );
  assertExact(
    existingItem.materials || [],
    data.materials || [],
    "material",
    (prev, next) =>
      (prev.itemId || null) === (next.itemId || null) &&
      near(prev.quantity, next.quantity) &&
      near(prev.unitPrice, next.unitPrice) &&
      (prev.descriptionSnapshot || "") === (next.descriptionSnapshot || "")
  );
  assertLockedSubset(
    existingItem.extras || [],
    data.extras || [],
    startedAt,
    "extra",
    (prev, next) =>
      prev.description === next.description &&
      near(prev.quantity, next.quantity) &&
      near(prev.unitPrice, next.unitPrice)
  );
  assertExact(
    existingItem.installations || [],
    data.installations || [],
    "instalacion",
    (prev, next) =>
      (prev.installationConceptId || null) === (next.installationConceptId || null) &&
      near(prev.quantity, next.quantity) &&
      near(prev.unitPrice, next.unitPrice)
  );
}

function assertExact(existingRows, incomingRows, label, same) {
  if (incomingRows.length !== existingRows.length) {
    throw new ValidationError(`No se pueden agregar ni quitar ${label}s en la revision`);
  }
  for (const prev of existingRows) {
    const next = incomingRows.find((row) => row.id === prev.id);
    if (!next) {
      throw new ValidationError(`No se puede quitar un ${label} ya capturado`);
    }
    requireSame(label, same(prev, next));
  }
}

function assertLockedSubset(existingRows, incomingRows, startedAt, label, same) {
  const locked = existingRows.filter((row) => isLocked(row, startedAt));
  for (const prev of locked) {
    const next = incomingRows.find((row) => row.id === prev.id);
    if (!next) {
      throw new ValidationError(`No se puede quitar un ${label} ya capturado`);
    }
    requireSame(label, same(prev, next));
  }
  const known = new Set(existingRows.map((row) => row.id));
  for (const row of incomingRows) {
    if (row.id && !known.has(row.id)) {
      throw new ValidationError(`El ${label} no pertenece a la partida`);
    }
  }
}

export function attachLineIdentity(rows, existingRows) {
  const byId = new Map((existingRows || []).map((row) => [row.id, row]));
  return (rows || []).map((row) => {
    const prev = row.id ? byId.get(row.id) : null;
    if (!prev) {
      const { id, ...rest } = row;
      return rest;
    }
    return { ...row, id: prev.id, createdAt: prev.createdAt };
  });
}
