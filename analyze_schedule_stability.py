#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
#   "matplotlib",
#   "seaborn",
# ]
# ///
"""
Analyze schedule stability to determine if GTFS data can be published once
or needs frequent updates. Focuses on practical impact of variations.
"""

import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Configuration
BUS_GTFS = Path("data_sources/bus_timetable/out/bus_scot_gtfs.zip")
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")
OUTPUT_DIR = Path("analysis_output")

def analyze_stability(feed, name):
    """Analyze how stable schedules are for publication purposes."""
    print(f"\n{'='*60}")
    print(f"  {name} GTFS Stability Analysis")
    print(f"{'='*60}")

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
    print(f"\nData coverage: {min_date} to {max_date}")

    # Calculate date range span
    year_start = int(min_date[:4])
    month_start = int(min_date[4:6])
    day_start = int(min_date[6:8])
    date_start = datetime(year_start, month_start, day_start)

    year_end = int(max_date[:4])
    month_end = int(max_date[4:6])
    day_end = int(max_date[6:8])
    date_end = datetime(year_end, month_end, day_end)

    days_span = (date_end - date_start).days
    print(f"Duration: {days_span} days ({days_span/7:.1f} weeks)")

    # Merge trips with calendar
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')

    # 1. WEEKDAY VARIATION ANALYSIS
    print(f"\n{'─'*60}")
    print("1. WEEKDAY VARIATION (within same week)")
    print(f"{'─'*60}")

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    weekday_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    # Count trips per route per weekday
    route_weekday_trips = defaultdict(lambda: {day: 0 for day in weekday_names})

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('monday')):
            continue

        route_id = trip['route_id']
        for day_col, day_name in zip(weekday_cols, weekday_names):
            if int(trip[day_col]) == 1:
                route_weekday_trips[route_id][day_name] += 1

    # Calculate weekday variation statistics
    weekday_variations = []
    for route_id, day_counts in route_weekday_trips.items():
        counts = list(day_counts.values())
        if max(counts) == 0:
            continue

        min_trips = min(counts)
        max_trips = max(counts)
        variation_pct = ((max_trips - min_trips) / max_trips * 100) if max_trips > 0 else 0

        route_name = routes[routes['route_id'] == route_id]['route_short_name'].values
        route_name = route_name[0] if len(route_name) > 0 else route_id

        weekday_variations.append({
            'route_id': route_id,
            'route_name': route_name,
            'min_trips': min_trips,
            'max_trips': max_trips,
            'variation_pct': variation_pct,
            'day_counts': day_counts
        })

    weekday_variations.sort(key=lambda x: x['variation_pct'], reverse=True)

    # Categorize routes by variation
    stable_routes = [r for r in weekday_variations if r['variation_pct'] < 10]
    moderate_routes = [r for r in weekday_variations if 10 <= r['variation_pct'] < 50]
    high_variation_routes = [r for r in weekday_variations if r['variation_pct'] >= 50]

    total_routes = len(weekday_variations)
    print(f"\nTotal routes analyzed: {total_routes}")
    print(f"\nWeekday variation categories:")
    print(f"  Stable (<10% variation):     {len(stable_routes):4d} ({len(stable_routes)/total_routes*100:5.1f}%)")
    print(f"  Moderate (10-50% variation): {len(moderate_routes):4d} ({len(moderate_routes)/total_routes*100:5.1f}%)")
    print(f"  High (≥50% variation):       {len(high_variation_routes):4d} ({len(high_variation_routes)/total_routes*100:5.1f}%)")

    print(f"\n⚠️  Top 5 most variable routes:")
    for r in weekday_variations[:5]:
        print(f"  {r['route_name']}: {r['min_trips']}-{r['max_trips']} trips/day ({r['variation_pct']:.0f}% variation)")
        day_str = ", ".join([f"{day}:{count}" for day, count in r['day_counts'].items()])
        print(f"    [{day_str}]")

    # 2. WEEKLY STABILITY ANALYSIS
    print(f"\n{'─'*60}")
    print("2. WEEKLY STABILITY (across different weeks)")
    print(f"{'─'*60}")

    # Track service patterns by week
    route_weekly_services = defaultdict(lambda: defaultdict(set))

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('start_date')) or pd.isna(trip.get('end_date')):
            continue

        route_id = trip['route_id']
        service_id = trip['service_id']
        start_date = str(int(trip['start_date']))
        end_date = str(int(trip['end_date']))

        try:
            # Parse dates
            year_start = int(start_date[:4])
            month_start = int(start_date[4:6])
            day_start = int(start_date[6:8])
            date_start = datetime(year_start, month_start, day_start)

            year_end = int(end_date[:4])
            month_end = int(end_date[4:6])
            day_end = int(end_date[6:8])
            date_end = datetime(year_end, month_end, day_end)

            # Enumerate all weeks
            current_date = date_start
            while current_date <= date_end:
                week_key = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"
                route_weekly_services[route_id][week_key].add(service_id)
                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze weekly stability
    if len(route_weekly_services) == 0:
        print("No multi-week data available")
    else:
        stable_count = 0
        changing_count = 0
        examples = []

        for route_id, weeks in route_weekly_services.items():
            if len(weeks) <= 1:
                continue

            # Check if all weeks have same service IDs
            service_sets = [frozenset(services) for services in weeks.values()]
            unique_patterns = len(set(service_sets))

            route_name = routes[routes['route_id'] == route_id]['route_short_name'].values
            route_name = route_name[0] if len(route_name) > 0 else route_id

            if unique_patterns == 1:
                stable_count += 1
            else:
                changing_count += 1
                if len(examples) < 5:
                    examples.append({
                        'route_name': route_name,
                        'weeks': len(weeks),
                        'patterns': unique_patterns
                    })

        total_multiweek = stable_count + changing_count

        if total_multiweek > 0:
            print(f"\nRoutes with multi-week data: {total_multiweek}")
            print(f"  Stable across all weeks:  {stable_count:4d} ({stable_count/total_multiweek*100:5.1f}%)")
            print(f"  Changing week-to-week:    {changing_count:4d} ({changing_count/total_multiweek*100:5.1f}%)")

            if examples:
                print(f"\nExamples of week-to-week changes:")
                for ex in examples:
                    print(f"  {ex['route_name']}: {ex['patterns']} different patterns across {ex['weeks']} weeks")
        else:
            print("\n⚠️  Data appears to be trimmed to single week")
            print("    Cannot assess weekly stability")
            print("    Re-download with: SKIP_TRIM=1 ./download_timetables.sh")

    # 3. PUBLICATION RECOMMENDATION
    print(f"\n{'='*60}")
    print("PUBLICATION ASSESSMENT")
    print(f"{'='*60}")

    if len(high_variation_routes) / total_routes > 0.3:
        print("\n⚠️  HIGH weekday variation detected!")
        print(f"   {len(high_variation_routes)/total_routes*100:.0f}% of routes vary ≥50% between weekdays")
        print("   Your published data MUST account for day-of-week")
    else:
        print("\n✓ Weekday variation is moderate for most routes")

    if changing_count > 0 and changing_count / total_multiweek > 0.1:
        print(f"\n⚠️  Schedules change week-to-week")
        print(f"   {changing_count/total_multiweek*100:.0f}% of routes have different patterns across weeks")
        print(f"   Data valid for: {days_span} days from publication")
        print(f"   Recommended update frequency: Monthly or when GTFS is updated")
    elif total_multiweek > 0:
        print(f"\n✓ Schedules are stable week-to-week")
        print(f"   Data valid for: {days_span} days")
        print(f"   Can publish once and use for the entire period")

    return {
        'name': name,
        'total_routes': total_routes,
        'stable_routes': len(stable_routes),
        'moderate_routes': len(moderate_routes),
        'high_variation_routes': len(high_variation_routes),
        'weekday_variations': weekday_variations,
        'days_span': days_span,
        'stable_weekly': stable_count,
        'changing_weekly': changing_count,
    }

def create_visualizations(bus_results, rail_results):
    """Create visualizations of the variation data."""
    OUTPUT_DIR.mkdir(exist_ok=True)

    # 1. Weekday variation distribution
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    for idx, results in enumerate([bus_results, rail_results]):
        if results is None:
            continue

        ax = axes[idx]
        variations = [r['variation_pct'] for r in results['weekday_variations']]

        ax.hist(variations, bins=20, edgecolor='black', alpha=0.7)
        ax.axvline(10, color='green', linestyle='--', label='10% (Stable)')
        ax.axvline(50, color='red', linestyle='--', label='50% (High variation)')
        ax.set_xlabel('Weekday Variation (%)')
        ax.set_ylabel('Number of Routes')
        ax.set_title(f'{results["name"]} - Weekday Variation Distribution')
        ax.legend()
        ax.grid(axis='y', alpha=0.3)

    plt.tight_layout()
    output_file = OUTPUT_DIR / 'weekday_variation_distribution.png'
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    print(f"\n📊 Saved: {output_file}")
    plt.close()

    # 2. Category breakdown pie charts
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    for idx, results in enumerate([bus_results, rail_results]):
        if results is None:
            continue

        ax = axes[idx]
        sizes = [
            results['stable_routes'],
            results['moderate_routes'],
            results['high_variation_routes']
        ]
        labels = ['Stable\n(<10%)', 'Moderate\n(10-50%)', 'High\n(≥50%)']
        colors = ['#2ecc71', '#f39c12', '#e74c3c']

        ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
               startangle=90, textprops={'fontsize': 10})
        ax.set_title(f'{results["name"]} Routes by Weekday Variation')

    plt.tight_layout()
    output_file = OUTPUT_DIR / 'variation_categories.png'
    plt.savefig(output_file, dpi=150, bbox_inches='tight')
    print(f"📊 Saved: {output_file}")
    plt.close()

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

    bus_results = analyze_stability(bus_feed, "Bus")
    rail_results = analyze_stability(rail_feed, "Rail")

    if bus_results or rail_results:
        create_visualizations(bus_results, rail_results)

    print(f"\n{'='*60}")
    print("SUMMARY FOR PUBLICATION")
    print(f"{'='*60}")
    print("\n1. You MUST handle day-of-week in your analysis")
    print("   Most routes have significantly different schedules on different days")
    print("\n2. For weekly stability:")
    print("   - If data is trimmed to 1 week: Re-download with SKIP_TRIM=1")
    print("   - If routes are stable week-to-week: Can publish once")
    print("   - If routes change weekly: Update monthly or when GTFS updates")
    print("\n3. Check the visualizations in analysis_output/ for details")

if __name__ == "__main__":
    main()
