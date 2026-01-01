import { test, expect } from "@playwright/test";

test.describe("Munros List", () => {
  test("displays list of all munros", async ({ page }) => {
    await page.goto("/munros");

    await expect(page.locator("h1")).toContainText("All Munros");

    // Should have munro links
    const munroLinks = page.locator("a[href*='/munro/']");
    await expect(munroLinks.first()).toBeVisible();
  });
});

test.describe("Individual Munro Page", () => {
  test("shows munro details and routes", async ({ page }) => {
    await page.goto("/munros");

    // Click on first munro
    const firstMunro = page.locator("a[href*='/munro/']").first();
    await firstMunro.click();

    // Should show munro name and details
    await expect(page.locator("h1")).toBeVisible();

    // Should show routes that include this munro
    await expect(page.locator("text=/route|access/i").first()).toBeVisible();
  });
});
