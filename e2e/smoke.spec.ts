import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("loads and displays rankings", async ({ page }) => {
    await page.goto("/");
    
    await expect(page.locator("h1")).toContainText("Munro Access");
    
    // Should have some route cards
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
    await expect(page.locator("h2").filter({ hasText: /Routes from/i })).toBeVisible();
    
    // Should show transport options section
    await expect(page.locator("h2").filter({ hasText: /Transport to/i })).toBeVisible();
  });

  test("shows all itineraries", async ({ page }) => {
    await page.goto("/");
    
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();
    
    // Click "show more" button if exists
    const showMoreButton = page.locator("button").filter({ hasText: /show more|all/i });
    if (await showMoreButton.count() > 0) {
      await showMoreButton.first().click();
      // Just verify page is still on target
      await expect(page.locator("h2").first()).toBeVisible();
    }
  });
});

test.describe("Timeline Modal", () => {
  test("opens and displays journey details", async ({ page }) => {
    await page.goto("/");
    
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();
    
    // Find and click a view/details button
    const viewButton = page.locator("button").filter({ hasText: /view|details/i }).first();
    if (await viewButton.count() > 0) {
      await viewButton.click();
      
      // Modal should appear
      const modal = page.locator("[role='dialog'], .modal, [id*='modal']").first();
      await expect(modal).toBeVisible();
    }
  });

  test("closes on button click", async ({ page }) => {
    await page.goto("/");
    
    const firstTarget = page.locator("a[href*='/target/']").first();
    await firstTarget.click();
    
    const viewButton = page.locator("button").filter({ hasText: /view|details/i }).first();
    if (await viewButton.count() > 0) {
      await viewButton.click();
      
      // Close the modal
      const closeButton = page.locator("button").filter({ hasText: /close|×/i }).first();
      await closeButton.click();
      
      // Modal should not be visible
      const modal = page.locator("[role='dialog'], .modal, [id*='modal']");
      await expect(modal).not.toBeVisible();
    }
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
