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
});

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

    // Navigate to target page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Should still show transport options (just without cycling routes)
    await expect(
      page.locator("h2").filter({ hasText: /Transport to/i })
    ).toBeVisible();
  });

  test("expands itinerary with preferences set", async ({ page }) => {
    await page.goto("/");

    // Set preferences on homepage - set time preference instead of cycling
    const prefsToggle = page.getByTestId("preferences-toggle");
    await prefsToggle.click();

    // Change earliest departure time to 8am
    const earliestDepartureInput = page.locator("input[type='time']").first();
    await earliestDepartureInput.fill("08:00");

    // Close preferences
    await prefsToggle.click();

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

    // Navigate to target page
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();

    // Find and click a view/details button
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
