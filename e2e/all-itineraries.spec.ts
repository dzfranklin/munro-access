import { test, expect } from "@playwright/test";

test.describe("All Itineraries Page", () => {
  test("displays outbound and return itineraries", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Click "View all transport options"
    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await allItinerariesLink.click();

    // Should show outbound and return sections
    await expect(
      page
        .locator("h4")
        .filter({ hasText: /Outbound/i })
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator("h4")
        .filter({ hasText: /Return/i })
        .first()
    ).toBeVisible();
  });

  test("expands itinerary details with +/− buttons", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await allItinerariesLink.click();

    // Should have expand button (+ symbol)
    const expandButton = page
      .locator("button")
      .filter({ hasText: /\+/ })
      .first();
    await expect(expandButton).toBeVisible();

    // Click to expand
    await expandButton.click();

    // Should show detailed leg information
    await expect(
      page.locator("text=/Depart|Arrive|Walk|Bus|Rail/i").first()
    ).toBeVisible();

    // Should have collapse button (− symbol)
    const collapseButton = page
      .locator("button")
      .filter({ hasText: /−/ })
      .first();
    await expect(collapseButton).toBeVisible();

    // Click to collapse
    await collapseButton.click();

    // Expand button should be visible again
    await expect(expandButton).toBeVisible();
  });

  test("filters itineraries with cycling disabled", async ({ page }) => {
    await page.goto("/");

    // Set preferences on homepage
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    const cyclingCheckbox = page
      .locator("label")
      .filter({ hasText: /Allow cycling/i })
      .locator("input[type='checkbox']");
    await cyclingCheckbox.uncheck();

    // Close preferences
    await prefsToggle.click();

    // Navigate to target and then all itineraries page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await allItinerariesLink.click();

    // Should still show outbound and return sections (just filtered)
    await expect(
      page
        .locator("h4")
        .filter({ hasText: /Outbound/i })
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator("h4")
        .filter({ hasText: /Return/i })
        .first()
    ).toBeVisible();
  });

  test("respects time preferences", async ({ page }) => {
    await page.goto("/");

    // Set preferences on homepage
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    // Change earliest departure time to 9am
    const earliestDepartureInput = page.locator("input[type='time']").first();
    await earliestDepartureInput.fill("09:00");

    // Close preferences
    await prefsToggle.click();

    // Navigate to target and then all itineraries page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await allItinerariesLink.click();

    // Should still show transport options (filtered by time)
    await expect(
      page
        .locator("h4")
        .filter({ hasText: /Outbound/i })
        .first()
    ).toBeVisible();
  });

  test("expands itinerary details with preferences set", async ({ page }) => {
    await page.goto("/");

    // Set preferences on homepage
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    // Change earliest departure time to 8am
    const earliestDepartureInput = page.locator("input[type='time']").first();
    await earliestDepartureInput.fill("08:00");

    // Close preferences
    await prefsToggle.click();

    // Navigate to target and then all itineraries page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await allItinerariesLink.click();

    // Should have expand button (+ symbol)
    const expandButton = page
      .locator("button")
      .filter({ hasText: /\+/ })
      .first();
    await expect(expandButton).toBeVisible();

    // Click to expand
    await expandButton.click();

    // Should show detailed leg information
    await expect(
      page.locator("text=/Depart|Arrive|Walk|Bus|Rail/i").first()
    ).toBeVisible();

    // Should have collapse button (− symbol)
    const collapseButton = page
      .locator("button")
      .filter({ hasText: /−/ })
      .first();
    await expect(collapseButton).toBeVisible();

    // Click to collapse
    await collapseButton.click();

    // Expand button should be visible again
    await expect(expandButton).toBeVisible();
  });
});
