import { test, expect } from "@playwright/test";
import { FOLIOS } from "./constants.js";
import { loadIds, storageState } from "./helpers.js";

function dayKey(offset = 0) {
  const d = new Date(Date.now() - 6 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

test("dashboard gerencial: bloques, compromiso vencido, incidencia notificada y resuelta, exportes", async ({
  browser,
}) => {
  const ids = loadIds();
  const admin = await browser.newContext({ storageState: storageState("admin") });
  const page = await admin.newPage();

  // Compromiso vencido en el calendario de produccion (fuente del KPI 1).
  const planning = await page.request.patch(
    `/api/produccion/${ids.productionId}/items/${ids.productionItemId}`,
    { data: { commitmentDate: dayKey(-3), reason: "E2E KPI" } }
  );
  expect(planning.ok(), await planning.text()).toBeTruthy();

  await page.goto("/dashboard-gerencial");
  await expect(page.getByRole("heading", { name: "Dashboard gerencial" })).toBeVisible();
  await expect(page.getByText(/Periodo seleccionado:/)).toBeVisible();
  for (const title of ["Compromisos", "Ventas", "Facturas por recibir", "Cobranza", "Calidad"]) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }

  // El trabajo aparece como vencido / retrasado.
  const row = page.getByRole("row").filter({ hasText: FOLIOS.production });
  await expect(row).toBeVisible();
  await expect(row.getByText("Retrasado")).toBeVisible();

  // Registrar incidencia desde la junta: razon con responsable sugerido (vendedor).
  await row.getByRole("button", { name: "Incidencia" }).click();
  await page.getByLabel("Razón").selectOption("MATERIAL");
  await expect(page.getByLabel("Responsable de dar seguimiento")).toHaveValue(ids.ventasId);
  await page.getByLabel("Detalle corto (opcional)").fill("Comprar redondo 1045");
  await page.getByRole("button", { name: "Guardar y notificar" }).click();
  await expect(page.getByText("Incidencia registrada y responsable notificado")).toBeVisible();
  await expect(row.getByText("Detenido")).toBeVisible();

  // Cada KPI responde para el periodo y los exportes se generan.
  for (const tab of ["ventas", "recepcion", "cobranza", "calidad"]) {
    const res = await page.request.get(`/api/kpis/${tab}?period=year`);
    expect(res.ok(), `${tab}: ${res.status()}`).toBeTruthy();
  }
  const xlsx = await page.request.get("/api/kpis/exportar?format=xlsx&section=all&period=month");
  expect(xlsx.ok()).toBeTruthy();
  const zip = Buffer.from(await xlsx.body());
  expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  const pdf = await page.request.get("/api/kpis/exportar?format=pdf&section=all&period=month");
  expect(pdf.ok()).toBeTruthy();
  expect(Buffer.from(await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.goto("/dashboard-gerencial/junta");
  await expect(page.getByText(/COMSA — Junta semanal/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Semana \d+/ })).toBeVisible();

  // El vendedor recibe la notificacion y resuelve la incidencia.
  const sales = await browser.newContext({ storageState: storageState("ventas") });
  const sp = await sales.newPage();
  await sp.goto("/ventas");
  await sp.getByRole("button", { name: /Notificaciones: \d+ sin leer/ }).click();
  await sp.getByRole("button", { name: /Trabajo detenido por falta de material/ }).first().click();
  await expect(sp).toHaveURL(/\/incidencias\?id=/);
  await expect(sp.getByText("Seguimiento de incidencia")).toBeVisible();
  await sp.getByRole("button", { name: "Atender" }).click();
  await sp.getByLabel("Comentario").fill("Material comprado y recibido");
  await sp.getByRole("button", { name: "Marcar resuelta" }).click();
  await expect(sp.getByText("Resuelta: Material comprado y recibido")).toBeVisible();
  await sales.close();

  // De vuelta en el dashboard el trabajo ya no esta detenido.
  await page.goto("/dashboard-gerencial");
  await expect(row.getByText("Retrasado")).toBeVisible();
  await admin.close();
});

test("ventas no accede al dashboard gerencial ni a sus APIs", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: storageState("ventas") });
  const page = await ctx.newPage();
  const res = await page.request.get("/api/kpis/resumen");
  expect(res.status()).toBe(403);
  await page.goto("/dashboard-gerencial");
  await expect(page).toHaveURL(/acceso-denegado/);
  await ctx.close();
});
