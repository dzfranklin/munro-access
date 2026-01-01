# Claude Context

Guidelines for working on the Munro Access project.

## Project Overview

**Munro Access** finds munros accessible by public transport from Edinburgh,
Glasgow, and Stirling, ranked by intelligent scoring.

### Key Features

- **Smart Scoring** - Ranks routes by departure time, hike duration, return
  options, and total journey time
- **Top Rankings** - Home page shows best routes across all starting locations  
- **Target Pages** - Show hiking routes first, then transport options to reach
  trailheads
- **Detailed Itineraries** - Full journey breakdowns with times and connections
- **Sample data** from February 2026 - users must verify current timetables
- Statically generated site using react-router v7 to prerender


### Code Structure

```
results/
  scoring.ts            - Scoring algorithm and preferences
  best-itineraries.ts   - Logic to find top options
  itinerary-utils.ts    - Utilities for filtering returns
  schema.ts             - Data types
  parse.server.ts       - Load data from JSON files

app/
  utils/format.ts       - Time/date utilities
  routes/
    home.tsx            - Landing page with rankings
    target.tsx          - Trailhead detail pages
    munro.tsx           - Individual munro pages
  components/
    ItineraryDisplay.tsx - Journey details
    TimelineModal.tsx    - Interactive timeline
```

### Key Utilities

**Time/Date** (`app/utils/format.ts`):
- `formatDuration(minutes: number)` - "2h 43m" format
- `parseTime(timeStr: string)` - "09:30" → 9.5
- `calculateDuration(startDate, startTime, endDate, endTime)` - Duration in
  hours
- `isSameDay(itin1, itin2)` - Check if same date
- `isNextDay(outbound, return)` - Check if return is next day

**Itinerary** (`results/itinerary-utils.ts`):
- `getViableReturns(outbound, allReturns, route)` - Returns allowing ≥50% min
  route time

## Style Guide

### Design Philosophy

Traditional, information-dense aesthetic inspired by classic outdoor websites.

**Principles:**
- Clean layout, no clutter
- No emojis anywhere
- System fonts only (Georgia serif for headings, Verdana for body)
- Simple borders, no shadows or rounded corners
- Muted professional colors

### Colors

**Primary (Navy):**
- Headers/text: `theme-navy-900` (#1a365d)
- Links: `theme-navy-700` (#334e68)

**Secondary:**
- Green links: `theme-green-600` (#2f855a)
- Grays: standard Tailwind (gray-50 to gray-800)

**Backgrounds:**
- White primary
- gray-50 for info boxes/footers
- gray-100 for table headers

### Layout

- Max width: 960px (`max-w-240`)
- Use semantic HTML5 (`<header>`, `<section>`, `<footer>`)
- Border-bottom to separate sections
- Actual `<table>` elements for tabular data
- Info boxes: gray-50 background, simple border, no rounded corners

### Links

- Underlined by default
- Navy (`text-theme-navy-700`) for primary
- Green (`text-theme-green-600`) for secondary  
- External links: `target="_blank" rel="noopener noreferrer"`
- Internal links: no target blank

### Content Rules

**Show users:**
- Journey times, dates, transport modes
- Route statistics (distance, time, ascent)

**Hide from users:**
- Scoring values/percentages
- Algorithm details
- Debug info

## Notes

- **walkhighlands** - Always lowercase unless at start of sentence (then
  Walkhighlands)
- Use Tailwind utilities only (no inline styles)
- Custom theme in `app/app.css`
- Test with chrome-devtools after changes
