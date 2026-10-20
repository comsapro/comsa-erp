import { test as setup, expect } from "@playwright/test";
import { USERS } from "./constants.js";
import { login, storageState } from "./helpers.js";

for (const [role, user] of Object.entries(USERS)) {
  setup(`sesion ${role}`, async ({ page }) => {
    await login(page, user.email);
    await expect(page).not.toHaveURL(/\/login/);
    await page.context().storageState({ path: storageState(role) });
  });
}
