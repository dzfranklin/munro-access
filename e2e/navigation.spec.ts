import { test, expect } from "@playwright/test";

test.describe("Targets List", () => {
  test("displays list of all targets", async ({ page }) => {
    await page.goto("/targets");

    await expect(page.locator("h1")).toContainText("Route Locations");

    // Should have target links
    const targetLinks = page.locator("a[href*='/target/']");
    await expect(targetLinks.first()).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("navigates between pages", async ({ page }) => {
    await page.goto("/");

    // Navigate to targets
    await page.click("a[href='/targets']");
    await expect(page).toHaveURL("/targets");

    // Navigate to munros
    await page.click("a[href='/munros']");
    await expect(page).toHaveURL("/munros");

    // Navigate back home
    await page.click("a[href='/']");
    await expect(page).toHaveURL("/");
  });
});
