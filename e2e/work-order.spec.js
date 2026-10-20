import { test, expect } from "@playwright/test";
import { fetchPdf, loadIds, storageState } from "./helpers.js";

test("la orden de trabajo HTML y su PDF incluyen el QR", async ({ browser }) => {
  const ids = loadIds();
  const ctx = await browser.newContext({ storageState: storageState("supervisor") });
  const page = await ctx.newPage();
  await page.goto(
    `/produccion/${ids.productionId}/orden-trabajo?itemId=${ids.productionItemId}`
  );
  const qr = page.getByAltText("Codigo QR de la partida");
  await expect(qr).toBeVisible();
  const src = await qr.getAttribute("src");
  expect(src || "").toMatch(/^data:image\/png;base64,/);

  const pdf = await fetchPdf(
    page,
    `/api/produccion/${ids.productionId}/pdf/orden-trabajo?itemId=${ids.productionItemId}`
  );
  expect(pdf.images.some((img) => Math.abs(img.w - 54) < 1 && Math.abs(img.h - 54) < 1)).toBe(
    true
  );
  await ctx.close();
});
