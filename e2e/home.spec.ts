import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("loads and displays rankings", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Munro Access");

    // Should have some route cards
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects cycling preference in rankings", async ({ page }) => {
    await page.goto("/");

    // Open preferences and disable cycling
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    const cyclingCheckbox = page
      .locator("label")
      .filter({ hasText: /Allow cycling/i })
      .locator("input[type='checkbox']");
    await cyclingCheckbox.uncheck();

    // Close preferences
    await prefsToggle.click();

    // Should still show rankings (just filtered)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects time preferences in rankings", async ({ page }) => {
    await page.goto("/");

    // Open preferences and set late departure
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    // Change earliest departure time to 10am
    const earliestDepartureInput = page.locator("input[type='time']").first();
    await earliestDepartureInput.fill("10:00");

    // Close preferences
    await prefsToggle.click();

    // Should still show rankings (filtered by later departures)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("respects walking speed preference", async ({ page }) => {
    await page.goto("/");

    // Open preferences
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    // Change walking speed to slower (0.8x)
    // Find the walking speed label and get the slider after it
    const walkingSpeedLabel = page
      .locator("label")
      .filter({ hasText: /Walking Speed/i });
    const walkingSpeedSlider = walkingSpeedLabel
      .locator("~ input[type='range']")
      .first();
    await walkingSpeedSlider.fill("0.8");

    // Close preferences
    await prefsToggle.click();

    // Should still show rankings (with adjusted hike times)
    const routeCards = page.locator("a[href*='/target/']");
    await expect(routeCards.first()).toBeVisible();
  });

  test("actually filters out cycling routes when disabled", async ({
    page,
  }) => {
    await page.goto("/");

    // Check if there are any routes with "Bike" initially
    const initialTableBody = page.locator("tbody");
    const initialText = await initialTableBody.textContent();
    const hasCyclingRoutesInitially = initialText?.includes("Bike") ?? false;

    // Open preferences and disable cycling
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    const cyclingCheckbox = page
      .locator("label")
      .filter({ hasText: /Allow cycling/i })
      .locator("input[type='checkbox']");

    // Verify it's initially checked
    await expect(cyclingCheckbox).toBeChecked();

    // Uncheck it
    await cyclingCheckbox.uncheck();
    await expect(cyclingCheckbox).not.toBeChecked();

    // Close preferences
    await prefsToggle.click();

    // Wait for recomputation to complete
    await page.waitForTimeout(500);

    // Check that "Bike" does NOT appear in any itinerary
    const afterTableBody = page.locator("tbody");
    const afterText = await afterTableBody.textContent();
    expect(afterText).not.toContain("Bike");

    // Re-enable cycling
    await prefsToggle.click();
    await cyclingCheckbox.check();
    await expect(cyclingCheckbox).toBeChecked();
    await prefsToggle.click();

    // Wait for recomputation
    await page.waitForTimeout(500);

    // If we had cycling routes initially, they should be back
    if (hasCyclingRoutesInitially) {
      const finalTableBody = page.locator("tbody");
      const finalText = await finalTableBody.textContent();
      expect(finalText).toContain("Bike");
    }
  });
});
