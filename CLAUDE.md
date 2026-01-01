# Claude Context

Guidelines for working on the Munro Access project.

## Project Overview

**Munro Access** finds munros accessible by public transport from Edinburgh, Glasgow, and Stirling, ranked by intelligent scoring.

### Key Features

- **Smart Scoring** - Ranks routes by departure time, hike duration, return options, and total journey time
- **Top Rankings** - Home page shows best routes across all starting locations  
- **Target Pages** - Show hiking routes first, then transport options to reach trailheads
- **Detailed Itineraries** - Full journey breakdowns with times and connections

⚠️ **Sample data** from February 2026 - users must verify current timetables

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
  text-utils.ts         - Text formatting (deprecated - use utils/format.ts)
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
- `calculateDuration(startDate, startTime, endDate, endTime)` - Duration in hours
- `isSameDay(itin1, itin2)` - Check if same date
- `isNextDay(outbound, return)` - Check if return is next day

**Itinerary** (`results/itinerary-utils.ts`):
- `getViableReturns(outbound, allReturns, route)` - Returns allowing ≥50% min route time

## Style Guide

### Design Philosophy

Traditional, information-dense aesthetic inspired by classic outdoor websites.

**Principles:**
- Clean layout, no clutter
- No emojis anywhere
- System fonts only (Georgia serif for headings, Verdana for body)
- Simple borders, no shadows or rounded corners
- Muted professional colors

### Typography

**Headings:** Georgia serif
- Main title (h1): 32px, font-normal
- Section headings (h2): 24px, font-normal with bottom border
- Subsections (h3): 18px or 16px, font-bold

**Body text:** Verdana sans-serif
- Base: 14px
- Small: 13px
- Extra small: 12px

**Code:**
```css
--font-serif: Georgia, "Times New Roman", serif;
--font-sans: Verdana, Geneva, sans-serif;
```

### Color Palette

**Primary (Navy Blues):**
- Headers/Important text: `theme-navy-900` (#1a365d)
- Links/Accents: `theme-navy-700` (#334e68)
- Full scale: 50-950 defined in theme

**Secondary (Muted Green):**
- Secondary links: `theme-green-600` (#2f855a)

**Grays:**
- Use standard Tailwind grays (gray-50 to gray-800)
- Body text: #2d3748
- Secondary text: gray-600
- Tertiary text: gray-500

**Backgrounds:**
- White primary background
- gray-50 for info boxes and footers
- gray-100 for table headers

### Layout Patterns

**Page structure:**
- Max width: 960px (Tailwind: `max-w-240`)
- Padding: 20px (Tailwind: `px-5 py-5`)

**Sections:**
- Clear semantic HTML5 tags (`<header>`, `<section>`, `<footer>`)
- Border-bottom lines to separate sections (2-3px solid)
- Generous spacing between sections (mb-8 to mb-12)

**Tables:**
- Use actual `<table>` elements for tabular data
- Simple borders (border-collapse)
- Gray backgrounds for headers (bg-gray-100)
- Borders: border-b-2 for header, border-b for rows

**Info boxes:**
- Light gray background (bg-gray-50)
- Simple border (border border-gray-300)
- Padding: p-5
- No rounded corners, no shadows

### Links

**Styling:**
- `underline` by default (all links should be underlined)
- Navy for primary links: `text-theme-navy-700`
- Green for secondary links: `text-theme-green-600`
- Use `hover:no-underline` if a hover effect is desired, but underline by
  default is required

**External links:**
- All external links (links to other websites) must use `target="_blank"` and `rel="noopener noreferrer"`
- Internal links (navigation within the site using React Router `<Link>`) should NOT use `target="_blank"`

### Components

**ItineraryDisplay:**
- No emojis
- Text labels for transport modes (Train:, Bus:, etc.)
- Small, compact text (13px base, 12px details)
- Time aligned in fixed-width column

### Content Guidelines

**What to show users:**
- Journey times and dates
- Transport modes and connections
- Route statistics (distance, time, ascent)
- Clear action links (view details, see all options)

**What NOT to show users:**
- Internal scoring values or percentages
- Algorithm implementation details
- Debug information or technical metrics

### What to Avoid

❌ **Don't use:**
- Emojis anywhere
- Rounded corners (rounded-lg, rounded-md, etc.)
- Box shadows
- Gradient backgrounds
- Modern card-based layouts with floating effects
- Bright, saturated colors
- Web fonts (stick to system fonts)
- Animations or transitions (except simple hover effects)

✅ **Do use:**
- Semantic HTML tables for data
- Simple solid borders
- Traditional serif/sans-serif font pairings
- Muted, professional color palette
- Clear information hierarchy
- Generous line-height and spacing for readability

### Technical Implementation

- Use Tailwind CSS with custom theme (defined in `app/app.css`)
- All styles via Tailwind utility classes (no inline styles)
- Custom colors defined as CSS custom properties in `@theme` block
- System fonts only (no external font loading)
- Semantic HTML5 elements

## Development Process

After changes manually test using the chrome-devtools mcp. Exercise edge cases.
