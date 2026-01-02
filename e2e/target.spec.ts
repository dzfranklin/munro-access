import { test, expect } from "@playwright/test";
import { setPreferences } from "./helpers";

test.describe("Target Page", () => {
  test("displays target details and routes", async ({ page }) => {
    await page.goto("/");

    // Click on first target
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Should show routes section
    await expect(
      page.locator("h2").filter({ hasText: /Routes from/i })
    ).toBeVisible();

    // Should show transport options section
    await expect(
      page.locator("h2").filter({ hasText: /Transport to/i })
    ).toBeVisible();
  });

  test("expands itinerary details", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Should have expand button (⋯ symbol with aria-label)
    const showDetailsButton = page
      .getByRole("button", { name: "Show details" })
      .first();
    await expect(showDetailsButton).toBeVisible();

    // Click to expand
    await showDetailsButton.click();

    // Should show expanded itinerary details (legs)
    await expect(
      page.locator("text=/Depart|Arrive|Walk|Bus|Rail/i").first()
    ).toBeVisible();

    // Should have "hide" button
    const collapseButton = page.getByRole("button", { name: "hide" }).first();
    await expect(collapseButton).toBeVisible();

    // Click to collapse
    await collapseButton.click();

    // Show details button should be visible again
    await expect(showDetailsButton).toBeVisible();
  });

  test("shows all itineraries link", async ({ page }) => {
    await page.goto("/");

    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Should have link to all itineraries
    const allItinerariesLink = page.locator("a[href*='/all-itineraries']");
    await expect(allItinerariesLink).toBeVisible();
  });

  test("respects cycling preference", async ({ page }) => {
    // First, find a target with cycling routes BEFORE disabling cycling
    await page.goto("/");
    const targetLinks = page.locator("a[href*='/target/']");
    const targetCount = await targetLinks.count();

    let targetWithCycling = null;
    let targetHref = null;
    for (let i = 0; i < Math.min(targetCount, 20); i++) {
      const target = targetLinks.nth(i);

      // Check the parent row for bike/cycling indicators
      const row = target.locator("xpath=ancestor::tr[1]");
      const rowText = await row.textContent();

      if (rowText && rowText.includes("Bike")) {
        targetWithCycling = target;
        targetHref = await target.getAttribute("href");
        break;
      }
    }

    // Fail the test if no target with cycling routes was found
    if (!targetWithCycling || !targetHref) {
      throw new Error("No target with cycling routes found on the home page");
    }

    // Disable cycling preference
    await setPreferences(page, { ranking: { allowCycling: false } });

    // Navigate to the target we found earlier (using the href directly)
    await page.goto(targetHref);

    await expect(
      page.locator("h2").filter({ hasText: /Transport to/i })
    ).toBeVisible();

    // Assert no cycling routes shown - check the entire page content
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("Bike");
  });

  test("expands itinerary with preferences set", async ({ page }) => {
    await setPreferences(page, { ranking: { earliestDeparture: 8 } });
    await page.goto("/");

    // Navigate to target page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Expand itinerary details
    const showDetailsButton = page
      .getByRole("button", { name: "Show details" })
      .first();
    await showDetailsButton.click();

    // Should have "hide" button after expanding
    const collapseButton = page.getByRole("button", { name: "hide" }).first();
    await expect(collapseButton).toBeVisible();

    // Verify expanded content is visible (any of the common leg text)
    await expect(
      page.locator("text=/Depart|Arrive|Walk|Bus|Rail|Train/i").first()
    ).toBeVisible();
  });
});
