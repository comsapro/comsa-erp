import { test, expect } from "@playwright/test";
import { INVOICE_NUMBER } from "./constants.js";
import { loadIds, storageState } from "./helpers.js";

test("el vendedor ve facturas sin recepcion, edita y marca la recepcion", async ({
  browser,
}) => {
  const ids = loadIds();
  const ctx = await browser.newContext({ storageState: storageState("ventas") });
  const page = await ctx.newPage();

  await page.goto("/ventas");
  await expect(page.getByText("Facturas sin recepción")).toBeVisible();
  await expect(page.getByText("$125,000.00")).toBeVisible();
  await page.getByRole("link", { name: /Ver facturas sin recepción/ }).click();
  await expect(page).toHaveURL(/pendiente=1/);
  await expect(page.getByText(INVOICE_NUMBER)).toBeVisible();

  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: `Editar factura ${INVOICE_NUMBER}` })).toBeVisible();
  await page
    .getByText("Número de PO del cliente")
    .locator("xpath=..")
    .getByRole("textbox")
    .fill("PO-E2E-EDIT");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page).toHaveURL(/\/ventas\/facturas/);

  await page.goto("/ventas/facturas?pendiente=1");
  await page.getByRole("button", { name: "Marcar recepción" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("No hay facturas pendientes de recepción.")).toBeVisible();

  await page.goto("/ventas");
  await expect(page.getByText("Ninguna factura pendiente de recepción del cliente.")).toBeVisible();
  await ctx.close();
});
