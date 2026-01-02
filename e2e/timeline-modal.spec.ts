import { test, expect } from "@playwright/test";
import { setPreferences } from "./helpers";

test.describe("Timeline Modal", () => {
  test("opens and displays journey details", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Find and click a view/details button
    page
      .locator("button")
      .filter({ hasText: /timeline/i })
      .first()
      .click();

    // Modal should appear
    const modal = page.locator("[role='dialog']").first();
    await expect(modal).toBeVisible();
  });

  test("closes on button click", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Find and click a view/details button
    page
      .locator("button")
      .filter({ hasText: /timeline/i })
      .first()
      .click();

    // Close the modal
    const closeButton = page
      .locator("button")
      .filter({ hasText: /close|×/i })
      .first();
    await closeButton.click();

    // Modal should not be visible
    const modal = page.locator("[role='dialog']");
    await expect(modal).not.toBeVisible();
  });

  test("opens with preferences set", async ({ page }) => {
    await setPreferences(page, { ranking: { allowCycling: false } });
    await page.goto("/");

    // Navigate to target page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    page
      .locator("button")
      .filter({ hasText: /timeline/i })
      .first()
      .click();

    // Modal should appear with journey details
    const modal = page.locator("[role='dialog']").first();
    await expect(modal).toBeVisible();
  });
});
