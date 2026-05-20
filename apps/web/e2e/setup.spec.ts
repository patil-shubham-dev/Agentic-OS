import { test, expect } from "@playwright/test";

test("redirects to dashboard page on first load", async ({ page }) => {
  await page.goto("/");
  // Bypasses /setup and opens dashboard directly as requested by the user
  await expect(page).toHaveURL(/\/dashboard/);
});
