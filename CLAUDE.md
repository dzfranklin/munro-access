# Claude Context

This document contains important context and guidelines for working on the Munro
Access project.

## Project Overview

**Munro Access** helps users find munros accessible by public transport from
Edinburgh, Glasgow, and Stirling.

### Key Features

1. **Intelligent Itinerary Scoring** - Each route is scored based on departure
   time, hike duration, return options, connection time, total duration, and
   sunset constraints
2. **Top Route Rankings** - Home page shows best routes ranked by score across
   all starting locations
3. **Detailed Target Pages** - Individual trailhead pages show all available
   routes first, then public transport options to reach that trailhead
4. **Detailed Itineraries** - Full journey breakdowns with times, transport
   modes, and connections

### How Scoring Works

Each outbound + return journey pair is evaluated:

1. **Feasibility Checks** (must pass):
   - Departure not too early
   - Hike finishes before sunset
   - Adequate buffer time before return

2. **Scoring Components** (0-1 scale, weighted):
   - Departure time (prefers ~9am)
   - Hike duration (prefers 1.5x route time available)
   - Return options (boosted if multiple returns exist)
   - Connection time (penalizes < 10min connections)
   - Total duration (prefers shorter journeys)

3. **Final Score**: Weighted average, normalized to 0-100%

### Data Sources

- **Route Information**: walkhighlands (all lower case unless at start of
  sentence, in which ase Walkhighlands)
- **Public Transport**: OpenTripPlanner with GTFS data
- **Sample Week**: February 2026 (weekday and weekend patterns)

⚠️ **Important**: Sample data only - users must verify current timetables before
traveling

### Code Structure

```
results/
  scoring.ts           - Scoring algorithm and preferences
  best-itineraries.ts  - Logic to find top options
  schema.ts            - Data types
  parse.ts             - Load data from JSON files

app/
  routes/
    home.tsx           - Landing page with top routes
    target.tsx         - Trailhead pages: routes first, then transport options
    munro.tsx          - Individual munro pages
  components/
    ItineraryDisplay.tsx - Shows journey details
```

## Style Guide

### Design Philosophy

This site uses a **traditional,  aesthetic** inspired by classic
hiking and outdoor resource websites. The goal is to look
clean and trustworthy, avoiding modern trendy design patterns.

**Key principles:**
- Clean and information-dense
- Traditional without being cluttered
- Would look appropriate (and better than average) if designed 10+ years ago
- Modern web development practices under the hood
- No emojis anywhere in the UI

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

Use chrome-devtools mcp to manually test changes
