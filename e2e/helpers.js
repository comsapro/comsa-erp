import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { E2E_PASSWORD } from "./constants.js";
import { pdfImages, pdfText } from "./pdf.js";

const authDir = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth");

export function loadIds() {
  return JSON.parse(fs.readFileSync(path.join(authDir, "ids.json"), "utf8"));
}

export function storageState(role) {
  return path.join(authDir, `${role}.json`);
}

export async function login(page, email, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

export async function openCombobox(locator) {
  await locator.click();
  const root = locator.locator("xpath=ancestor::div[contains(@class,'relative')][1]");
  await expect(root.getByPlaceholder("Escribe para buscar...")).toBeVisible();
  return root;
}

export async function searchCombobox(page, label, query) {
  const field = page.getByLabel(label).first();
  const root = await openCombobox(field);
  await root.getByPlaceholder("Escribe para buscar...").fill(query);
  await expect(root.getByText("Buscando...")).toHaveCount(0, { timeout: 15_000 });
  return root;
}

export async function fetchPdf(page, url) {
  const response = await page.request.get(url);
  expect(response.ok(), `PDF ${url} -> ${response.status()}`).toBeTruthy();
  const buffer = Buffer.from(await response.body());
  expect(buffer.length).toBeGreaterThan(1000);
  return { buffer, text: pdfText(buffer), images: pdfImages(buffer) };
}
