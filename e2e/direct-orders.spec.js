import { test, expect } from "@playwright/test";
import { loadIds, storageState } from "./helpers.js";

test("orden directa con partidas de cotizacion oculta Items simples y se envia", async ({
  browser,
}) => {
  const ids = loadIds();
  const ctx = await browser.newContext({ storageState: storageState("ventas") });
  const page = await ctx.newPage();
  await page.goto(`/ordenes-directas/${ids.directOrderId}`);
  await expect(page.getByText("Procesos, materiales y extras")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Items simples" })).toHaveCount(0);
  await expect(page.getByText(/Estos datos se copian a la cotización/)).toBeVisible();
  await page.getByLabel("Requisicion").fill("R-E2E-SYNC");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Orden actualizada")).toBeVisible();
  const quoteRes = await page.request.get(`/api/cotizaciones/${ids.directQuoteId}`);
  expect(quoteRes.ok()).toBeTruthy();
  const quote = await quoteRes.json();
  expect(quote.requisition).toBe("R-E2E-SYNC");
  const submit = page.getByRole("button", { name: "Enviar a aprobacion" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Pendiente de aprobacion")).toBeVisible();
  await ctx.close();
});
