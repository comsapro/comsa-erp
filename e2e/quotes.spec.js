import { test, expect } from "@playwright/test";
import { FOLIOS, QTY_SUBTOTAL } from "./constants.js";
import { fetchPdf, loadIds, searchCombobox, storageState } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Cotizaciones", () => {
  test("15 piezas x $17,050 aparecen en detalle, impresion y PDF tras aprobar", async ({
    browser,
  }) => {
    const ids = loadIds();
    const ventasCtx = await browser.newContext({ storageState: storageState("ventas") });
    const ventasPage = await ventasCtx.newPage();
    await ventasPage.goto(`/cotizaciones/${ids.qtyQuoteId}`);
    await expect(ventasPage.getByText(FOLIOS.qtyQuote)).toBeVisible();
    await expect(ventasPage.getByText("15").first()).toBeVisible();
    await expect(ventasPage.getByText(QTY_SUBTOTAL).first()).toBeVisible();
    await ventasPage.getByRole("button", { name: "Enviar" }).click();
    await expect(ventasPage.getByText("En revision")).toBeVisible();
    await ventasCtx.close();

    const superCtx = await browser.newContext({
      storageState: storageState("supervisor"),
    });
    const superPage = await superCtx.newPage();
    await superPage.goto(`/cotizaciones/${ids.qtyQuoteId}`);
    await superPage.getByRole("button", { name: "Aprobar" }).click();
    await expect(superPage.getByText("Aprobada")).toBeVisible();
    await superPage.goto(`/cotizaciones/${ids.qtyQuoteId}/imprimir`);
    await expect(superPage.getByText(QTY_SUBTOTAL).first()).toBeVisible();
    const pdf = await fetchPdf(superPage, `/api/cotizaciones/${ids.qtyQuoteId}/pdf`);
    expect(pdf.text).toMatch(/255,750/);
    await superCtx.close();
  });

  test("comentario largo se imprime completo y no deja la primera pagina vacia", async ({
    browser,
  }) => {
    const ids = loadIds();
    const ctx = await browser.newContext({ storageState: storageState("supervisor") });
    const page = await ctx.newPage();
    await page.goto(`/cotizaciones/${ids.commentQuoteId}/imprimir`);
    const body = await page.locator(".print-quote").innerText();
    expect(body.trim().length).toBeGreaterThan(200);
    expect(body).toContain(ids.commentToken);
    expect(body).toMatch(/\$\d/);
    const pdf = await fetchPdf(page, `/api/cotizaciones/${ids.commentQuoteId}/pdf`);
    expect(pdf.text).toContain(ids.commentToken);
    await ctx.close();
  });

  test("buscar PALO en proveedores solo muestra La Paloma", async ({ browser }) => {
    const ids = loadIds();
    const ctx = await browser.newContext({ storageState: storageState("ventas") });
    const page = await ctx.newPage();
    await page.goto(`/cotizaciones/${ids.searchQuoteId}`);
    await page.getByLabel("Editar partida").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Materiales")).toBeVisible();
    const combo = await searchCombobox(dialog, "Proveedor", "PALO");
    await expect(combo.getByRole("option", { name: /La Paloma/ })).toBeVisible();
    await expect(combo.getByRole("option", { name: /Aceros Amil/ })).toHaveCount(0);
    await expect(combo.getByRole("option", { name: /Distribuidora Norte/ })).toHaveCount(0);
    await ctx.close();
  });
});
