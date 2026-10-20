import { test, expect } from "@playwright/test";
import { FOLIOS } from "./constants.js";
import { loadIds, storageState } from "./helpers.js";

test("supervisor ve la cotizacion compañera y la orden tras reenvio a aprobacion", async ({
  browser,
}) => {
  const ids = loadIds();
  const ctx = await browser.newContext({
    storageState: storageState("supervisor"),
  });
  const page = await ctx.newPage();

  await page.goto("/cotizaciones");
  await page.getByRole("button", { name: "Tabla" }).click();
  await page.getByRole("button", { name: "En revision" }).click();
  await page.getByLabel("Buscar").fill(FOLIOS.handbackQuote);
  await expect(page.getByRole("link", { name: FOLIOS.handbackQuote })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocurrio un error" })).toHaveCount(0);

  const quotesRes = await page.request.get(
    `/api/cotizaciones?status=PENDING_APPROVAL&q=${FOLIOS.handbackQuote}`
  );
  expect(quotesRes.ok()).toBeTruthy();
  const quotesBody = await quotesRes.json();
  expect((quotesBody.data || []).some((row) => row.folio === FOLIOS.handbackQuote)).toBeTruthy();

  await page.goto("/ordenes-directas");
  await page.getByRole("button", { name: "Tabla" }).click();
  await page.getByRole("button", { name: "Pendiente de aprobacion" }).click();
  await page.getByLabel("Buscar").fill(FOLIOS.handbackQuote);
  await expect(page.getByRole("link", { name: FOLIOS.handbackOrder })).toBeVisible();
  await expect(page.getByRole("link", { name: FOLIOS.handbackQuote })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocurrio un error" })).toHaveCount(0);

  await page.goto(`/cotizaciones/${ids.handbackQuoteId}`);
  await expect(page.getByText(FOLIOS.handbackQuote).first()).toBeVisible();
  await expect(page.getByText("En revision").first()).toBeVisible();

  await ctx.close();
});
