# Testing

## Overview

Two test suites protect the codebase during refactoring:

- **Unit tests** (Vitest) - Test utilities and business logic
- **E2E tests** (Playwright) - Smoke tests for pages and features

## Running Tests

```bash
# Unit tests
npm test              # Watch mode
npm test -- --run     # Run once

# E2E tests
npm run test:e2e      # Headless
npm run test:e2e:ui   # UI mode

# All tests
npm run test:all
```

## Unit Tests

Located next to implementation files (e.g., `format.test.ts` next to `format.ts`).

### Coverage

- `app/utils/format.ts` - Time/date formatting utilities
- `results/itinerary-utils.ts` - Itinerary filtering logic

### Adding Tests

Create `*.test.ts` files next to the code being tested. No mocking currently needed.

## E2E Tests

Located in `e2e/` directory.

### Coverage

- Home page loads and displays routes
- Target pages show routes and transport
- Timeline modals open/close
- Navigation between pages works
- All list pages (munros, targets) display

### Philosophy

Smoke tests - verify pages/features open without errors and display content. Not granular assertions on specific UI elements.

## Configuration

- Vitest: `vite.config.ts` (test section)
- Playwright: `playwright.config.ts`
