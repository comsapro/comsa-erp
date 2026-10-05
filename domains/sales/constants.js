export const SALES_GOAL_PERIODS = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  SEMIANNUAL: "SEMIANNUAL",
  ANNUAL: "ANNUAL",
};

export const SALES_CALENDAR_EVENT_TYPES = {
  DELIVERY: "DELIVERY",
  VACATION: "VACATION",
  OTHER: "OTHER",
};

export const SALES_CALENDAR_EVENT_LABELS = {
  DELIVERY: "Entrega",
  VACATION: "Vacaciones",
  OTHER: "Otro",
};

export const SALES_GOAL_PERIOD_LABELS = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

export const MATERIAL_SKIP_REASONS = {
  IN_STOCK: "IN_STOCK",
  CLIENT_PROVIDED: "CLIENT_PROVIDED",
  USE_SURPLUS: "USE_SURPLUS",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  OTHER: "OTHER",
};

export const MATERIAL_SKIP_REASON_LABELS = {
  IN_STOCK: "Material existente en almacén",
  CLIENT_PROVIDED: "Material proporcionado por cliente",
  USE_SURPLUS: "Se utilizará sobrante",
  NOT_APPLICABLE: "No aplica",
  OTHER: "Otro",
};

export const QUOTE_STATUS_PERIODS = [
  "general",
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
];

export function periodKeyFor(period, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (period === "MONTHLY") return `${y}-${String(m).padStart(2, "0")}`;
  if (period === "QUARTERLY") return `${y}-Q${Math.ceil(m / 3)}`;
  if (period === "SEMIANNUAL") return `${y}-H${m <= 6 ? 1 : 2}`;
  return String(y);
}

export function periodRange(period, periodKey) {
  if (period === "MONTHLY") {
    const [y, m] = periodKey.split("-").map(Number);
    return {
      from: new Date(y, m - 1, 1),
      to: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }
  if (period === "QUARTERLY") {
    const [y, qPart] = periodKey.split("-");
    const q = Number(String(qPart).replace("Q", ""));
    const startMonth = (q - 1) * 3;
    return {
      from: new Date(Number(y), startMonth, 1),
      to: new Date(Number(y), startMonth + 3, 0, 23, 59, 59, 999),
    };
  }
  if (period === "SEMIANNUAL") {
    const [y, hPart] = periodKey.split("-");
    const h = Number(String(hPart).replace("H", ""));
    const startMonth = h === 1 ? 0 : 6;
    return {
      from: new Date(Number(y), startMonth, 1),
      to: new Date(Number(y), startMonth + 6, 0, 23, 59, 59, 999),
    };
  }
  const y = Number(periodKey);
  return {
    from: new Date(y, 0, 1),
    to: new Date(y, 11, 31, 23, 59, 59, 999),
  };
}
