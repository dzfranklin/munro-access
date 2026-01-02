import { test, expect } from "@playwright/test";
import { setPreferences } from "./helpers";

test.describe("Home Page", () => {
  test("loads and displays rankings", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Munro Access");

    // Should have some route cards
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects cycling preference in rankings", async ({ page }) => {
    await setPreferences(page, { ranking: { allowCycling: false } });
    await page.goto("/");

    // Should still show rankings (just filtered)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects time preferences in rankings", async ({ page }) => {
    await setPreferences(page, { ranking: { earliestDeparture: 10 } });
    await page.goto("/");

    // Should still show rankings (filtered by later departures)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects walking speed preference", async ({ page }) => {
    await setPreferences(page, { ranking: { walkingSpeed: 0.8 } });
    await page.goto("/");

    // Should still show rankings (with adjusted hike times)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("actually filters out cycling routes when disabled", async ({
    page,
  }) => {
    // Check if there are any routes with "Bike" initially (with default preferences)
    await page.goto("/");
    const initialTableBody = page.locator("tbody");
    const initialText = await initialTableBody.textContent();
    const hasCyclingRoutesInitially = initialText?.includes("Bike") ?? false;

    // Disable cycling
    await setPreferences(page, { ranking: { allowCycling: false } });
    await page.goto("/");

    // Check that "Bike" does NOT appear in any itinerary
    const afterTableBody = page.locator("tbody");
    const afterText = await afterTableBody.textContent();
    expect(afterText).not.toContain("Bike");

    // Re-enable cycling
    await setPreferences(page, { ranking: { allowCycling: true } });
    await page.goto("/");

    // If we had cycling routes initially, they should be back
    if (hasCyclingRoutesInitially) {
      const finalTableBody = page.locator("tbody");
      const finalText = await finalTableBody.textContent();
      expect(finalText).toContain("Bike");
    }
  });
});
