#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Detailed week-to-week stability analysis to understand the magnitude
and significance of schedule variations across weeks.
"""

import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd

# Configuration
BUS_GTFS = Path("data_sources/bus_timetable/out/bus_scot_gtfs.zip")
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")

def analyze_weekly_stability_detailed(feed, name):
    """Deep dive into week-to-week variations."""
    print(f"\n{'='*70}")
    print(f"  {name} GTFS - Weekly Stability Deep Dive")
    print(f"{'='*70}")

    routes = feed.routes
    trips = feed.trips
    calendar = feed.calendar
    stop_times = feed.stop_times

    if calendar is None or calendar.empty:
        print(f"⚠️  No calendar data available")
        return None

    # Get date range
    min_date = calendar['start_date'].min()
    max_date = calendar['end_date'].max()

    # Parse dates
    year_start = int(min_date[:4])
    month_start = int(min_date[4:6])
    day_start = int(min_date[6:8])
    date_start = datetime(year_start, month_start, day_start)

    year_end = int(max_date[:4])
    month_end = int(max_date[4:6])
    day_end = int(max_date[6:8])
    date_end = datetime(year_end, month_end, day_end)

    # Calculate all weeks in range
    all_weeks = set()
    current = date_start
    while current <= date_end:
        week_key = f"{current.isocalendar()[0]}-W{current.isocalendar()[1]:02d}"
        all_weeks.add(week_key)
        current += timedelta(days=7)

    total_weeks = len(all_weeks)
    print(f"\nData range: {min_date} to {max_date}")
    print(f"Total weeks in data: {total_weeks}")

    # Merge trips with calendar and stop_times to count actual departures
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')

    # Build week-by-week trip counts per route
    print(f"\nAnalyzing trip patterns across weeks...")

    route_weekly_data = defaultdict(lambda: {
        'route_name': None,
        'weeks': defaultdict(lambda: {
            'service_ids': set(),
            'trip_count': 0,
            'weekday_pattern': None,
        })
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('start_date')) or pd.isna(trip.get('end_date')):
            continue

        route_id = trip['route_id']
        service_id = trip['service_id']

        # Get route name
        if route_weekly_data[route_id]['route_name'] is None:
            route_name = routes[routes['route_id'] == route_id]['route_short_name'].values
            route_weekly_data[route_id]['route_name'] = route_name[0] if len(route_name) > 0 else route_id

        # Parse dates
        start_date = str(int(trip['start_date']))
        end_date = str(int(trip['end_date']))

        try:
            year_start = int(start_date[:4])
            month_start = int(start_date[4:6])
            day_start = int(start_date[6:8])
            date_start = datetime(year_start, month_start, day_start)

            year_end = int(end_date[:4])
            month_end = int(end_date[4:6])
            day_end = int(end_date[6:8])
            date_end = datetime(year_end, month_end, day_end)

            # Enumerate all weeks this trip covers
            current_date = date_start
            weekday_pattern = tuple(int(trip[day]) if pd.notna(trip.get(day)) else 0 for day in weekday_cols)

            while current_date <= date_end:
                week_key = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"

                route_weekly_data[route_id]['weeks'][week_key]['service_ids'].add(service_id)
                route_weekly_data[route_id]['weeks'][week_key]['trip_count'] += 1
                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze variation patterns
    print(f"\nAnalyzing variation patterns...")

    results = {
        'stable': [],              # Same trip count every week
        'minor_variation': [],     # Trip count varies <20%
        'moderate_variation': [],  # Trip count varies 20-50%
        'high_variation': [],      # Trip count varies >50%
        'pattern_changes': [],     # Weekday pattern changes across weeks
        'single_week': [],         # Only operates one week
    }

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) == 0:
            continue

        if len(weeks) == 1:
            results['single_week'].append({
                'route_id': route_id,
                'route_name': route_name,
            })
            continue

        # Get trip counts across weeks
        trip_counts = [week_data['trip_count'] for week_data in weeks.values()]
        min_trips = min(trip_counts)
        max_trips = max(trip_counts)
        avg_trips = sum(trip_counts) / len(trip_counts)

        # Calculate variation
        if max_trips > 0:
            variation_pct = ((max_trips - min_trips) / max_trips) * 100
        else:
            variation_pct = 0

        # Check if weekday patterns change
        patterns = set(week_data['weekday_pattern'] for week_data in weeks.values() if week_data['weekday_pattern'])
        pattern_changes = len(patterns) > 1

        record = {
            'route_id': route_id,
            'route_name': route_name,
            'weeks': len(weeks),
            'min_trips': min_trips,
            'max_trips': max_trips,
            'avg_trips': avg_trips,
            'variation_pct': variation_pct,
            'num_patterns': len(patterns),
        }

        # Categorize
        if pattern_changes:
            results['pattern_changes'].append(record)
        elif variation_pct == 0:
            results['stable'].append(record)
        elif variation_pct < 20:
            results['minor_variation'].append(record)
        elif variation_pct < 50:
            results['moderate_variation'].append(record)
        else:
            results['high_variation'].append(record)

    # Sort by variation
    for category in results.values():
        if isinstance(category, list) and len(category) > 0 and 'variation_pct' in category[0]:
            category.sort(key=lambda x: x['variation_pct'], reverse=True)

    # Print results
    total_multi_week = sum(len(results[k]) for k in ['stable', 'minor_variation', 'moderate_variation', 'high_variation', 'pattern_changes'])

    print(f"\n{'─'*70}")
    print("WEEK-TO-WEEK VARIATION CATEGORIES")
    print(f"{'─'*70}")
    print(f"Total routes analyzed: {total_multi_week + len(results['single_week'])}")
    print(f"  Single week only: {len(results['single_week'])}")
    print(f"  Multi-week routes: {total_multi_week}")

    if total_multi_week > 0:
        print(f"\nMulti-week breakdown:")
        print(f"  Perfectly stable (0% variation):       {len(results['stable']):4d} ({len(results['stable'])/total_multi_week*100:5.1f}%)")
        print(f"  Minor variation (<20%):                {len(results['minor_variation']):4d} ({len(results['minor_variation'])/total_multi_week*100:5.1f}%)")
        print(f"  Moderate variation (20-50%):           {len(results['moderate_variation']):4d} ({len(results['moderate_variation'])/total_multi_week*100:5.1f}%)")
        print(f"  High variation (>50%):                 {len(results['high_variation']):4d} ({len(results['high_variation'])/total_multi_week*100:5.1f}%)")
        print(f"  Weekday pattern changes across weeks:  {len(results['pattern_changes']):4d} ({len(results['pattern_changes'])/total_multi_week*100:5.1f}%)")

        # Combined "publishable" category
        publishable = len(results['stable']) + len(results['minor_variation'])
        print(f"\n✓ Publishable long-term (<20% variation): {publishable:4d} ({publishable/total_multi_week*100:5.1f}%)")
        print(f"⚠️  Requires attention (≥20% or pattern changes): {total_multi_week - publishable:4d} ({(total_multi_week - publishable)/total_multi_week*100:5.1f}%)")

    # Show examples
    print(f"\n{'─'*70}")
    print("EXAMPLES OF VARIATION TYPES")
    print(f"{'─'*70}")

    if results['stable']:
        print(f"\n✓ Perfectly Stable (first 5):")
        for r in results['stable'][:5]:
            print(f"  {r['route_name']}: {r['avg_trips']:.0f} trips/week across {r['weeks']} weeks")

    if results['pattern_changes']:
        print(f"\n⚠️  Weekday Pattern Changes (first 5):")
        for r in results['pattern_changes'][:5]:
            print(f"  {r['route_name']}: {r['num_patterns']} different patterns across {r['weeks']} weeks")
            print(f"    Trip count: {r['min_trips']}-{r['max_trips']} ({r['variation_pct']:.0f}% variation)")

    if results['high_variation']:
        print(f"\n⚠️  High Variation (first 5):")
        for r in results['high_variation'][:5]:
            print(f"  {r['route_name']}: {r['min_trips']}-{r['max_trips']} trips ({r['variation_pct']:.0f}% variation) across {r['weeks']} weeks")

    # Temporal analysis - does variation happen in specific weeks?
    print(f"\n{'─'*70}")
    print("TEMPORAL PATTERNS")
    print(f"{'─'*70}")

    # Check if variation is seasonal or scattered
    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        if len(weeks) < 10:  # Need enough data
            continue

        # Check if high/low periods cluster
        trip_counts = [(week, week_data['trip_count']) for week, week_data in sorted(weeks.items())]

        # Simple check: does trip count have long stable runs?
        if len(set(tc for _, tc in trip_counts)) > 3:
            # Multiple distinct levels - likely seasonal
            # Could expand this to detect actual patterns
            pass

    print("(Seasonal pattern detection would go here with more sophisticated analysis)")

    return results

def main():
    if not BUS_GTFS.exists():
        print(f"ERROR: Bus GTFS not found: {BUS_GTFS}", file=sys.stderr)
        sys.exit(1)

    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    print("Reading GTFS data...")
    bus_feed = gk.read_feed(str(BUS_GTFS), dist_units='km')
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    bus_results = analyze_weekly_stability_detailed(bus_feed, "Bus")
    rail_results = analyze_weekly_stability_detailed(rail_feed, "Rail")

    print(f"\n{'='*70}")
    print("PUBLICATION RECOMMENDATIONS")
    print(f"{'='*70}")

    print("\nBased on this analysis:")
    print("1. Routes with <20% variation can be published long-term")
    print("2. Routes with pattern changes need per-week analysis or disclaimers")
    print("3. High variation routes may represent seasonal services")
    print("\nNext steps:")
    print("- Identify which routes users care about most")
    print("- For stable routes: publish with confidence")
    print("- For varying routes: either exclude or show date ranges")

if __name__ == "__main__":
    main()
