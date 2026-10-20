import { test, expect } from "@playwright/test";
import { fetchPdf, loadIds, searchCombobox, storageState } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test("OC desde produccion precarga costo cotizado y cantidad x piezas", async ({
  browser,
}) => {
  const ids = loadIds();
  const ctx = await browser.newContext({ storageState: storageState("compras") });
  const page = await ctx.newPage();
  await page.goto(`/produccion/${ids.productionId}`);
  await page.getByRole("link", { name: "Crear OC" }).click();
  await expect(page.getByText(/1 por pieza x 15 piezas/)).toBeVisible();
  await expect(page.getByText(/cotizado \$3,000/)).toBeVisible();
  await page.getByText("Placa E2E").first().click();
  const supplier = await searchCombobox(page, "Proveedor", "PALO");
  await supplier.getByRole("option", { name: /La Paloma/ }).click();
  await page.getByRole("button", { name: "Crear OC" }).click();
  await expect(page).toHaveURL(/\/ordenes-compra\/.+/);
  await expect(page.getByText("Cotizado:").or(page.getByText("$3,000"))).toBeVisible();
  await ctx.close();
});

test("OC pendiente no imprime; el supervisor corrige y luego el PDF existe", async ({
  browser,
}) => {
  const ids = loadIds();
  const comprasCtx = await browser.newContext({ storageState: storageState("compras") });
  const comprasPage = await comprasCtx.newPage();
  await comprasPage.goto(`/ordenes-compra/${ids.pendingPoId}`);
  await expect(
    comprasPage.getByText("El PDF estara disponible cuando un supervisor apruebe la orden")
  ).toBeVisible();
  await expect(comprasPage.getByRole("link", { name: "PDF" })).toHaveCount(0);
  await expect(comprasPage.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await comprasCtx.close();

  const superCtx = await browser.newContext({ storageState: storageState("supervisor") });
  const page = await superCtx.newPage();
  await page.goto(`/ordenes-compra/${ids.pendingPoId}`);
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel(/Costo unitario de Placa E2E/).fill("2800");
  const supplier = await searchCombobox(page, "Proveedor", "Amil");
  await supplier.getByRole("option", { name: /Aceros Amil/ }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Aceros Amil").first()).toBeVisible();
  await page.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByRole("link", { name: "PDF" })).toBeVisible();
  const pdf = await fetchPdf(page, `/api/ordenes-compra/${ids.pendingPoId}/pdf`);
  expect(pdf.buffer.length).toBeGreaterThan(1000);
  await superCtx.close();
});
