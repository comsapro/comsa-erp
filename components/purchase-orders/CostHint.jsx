import { formatMoney } from "@/lib/utils/format";

/** Referencia bajo el costo de una partida: costo cotizado y aviso si falta capturarlo. */
export function CostHint({ unitPrice, quotedUnitPrice }) {
  const price = Number(unitPrice) || 0;
  const quoted = quotedUnitPrice == null ? null : Number(quotedUnitPrice);

  if (price <= 0) {
    return (
      <p className="mt-1 text-xs font-medium text-danger-700" role="alert">
        Captura el costo
        {quoted ? ` (cotizado ${formatMoney(quoted)})` : ""}
      </p>
    );
  }
  if (quoted == null) return null;
  const changed = Math.abs(price - quoted) >= 0.01;
  return (
    <p
      className={`mt-1 text-xs ${changed ? "text-warning-700" : "text-content-muted"}`}
    >
      Cotizado: {formatMoney(quoted)}
      {changed ? " · costo actualizado" : ""}
    </p>
  );
}

export default CostHint;
