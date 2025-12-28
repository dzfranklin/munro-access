#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Analyze rail routes: For multi-schedule routes, what's the distribution
of weeks between schedules? Is there always a dominant schedule?
"""

import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd

# Configuration
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")

def analyze_rail_schedule_distribution(feed):
    """Analyze how weeks are distributed across schedules for rail routes."""
    print(f"\n{'='*70}")
    print(f"  Rail Schedule Distribution Analysis")
    print(f"{'='*70}")

    routes = feed.routes
    trips = feed.trips
    calendar = feed.calendar

    if calendar is None or calendar.empty:
        print(f"⚠️  No calendar data available")
        return None

    # Get date range
    min_date = calendar['start_date'].min()
    max_date = calendar['end_date'].max()
    print(f"\nData range: {min_date} to {max_date}")

    # Merge trips with calendar
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')

    # Build week-by-week patterns per route
    route_weekly_data = defaultdict(lambda: {
        'route_name': None,
        'weeks': defaultdict(lambda: {
            'service_ids': set(),
            'weekday_pattern': None,
            'trip_count': 0,
        })
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('start_date')) or pd.isna(trip.get('end_date')):
            continue

        route_id = trip['route_id']

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

                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern
                route_weekly_data[route_id]['weeks'][week_key]['trip_count'] += 1

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze distribution
    print(f"\nAnalyzing schedule distribution...")

    routes_by_schedule_count = defaultdict(list)

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) < 2:
            continue

        # Group weeks by schedule signature
        schedule_signatures = defaultdict(list)

        for week_key, week_data in weeks.items():
            pattern = week_data['weekday_pattern']
            trip_count = week_data['trip_count']
            trip_bucket = round(trip_count / 5) * 5
            signature = (pattern, trip_bucket)
            schedule_signatures[signature].append(week_key)

        num_schedules = len(schedule_signatures)

        # Calculate distribution
        schedule_week_counts = sorted(
            [len(weeks) for weeks in schedule_signatures.values()],
            reverse=True
        )

        total_weeks = len(weeks)
        dominant_weeks = schedule_week_counts[0]
        dominant_pct = (dominant_weeks / total_weeks) * 100

        routes_by_schedule_count[num_schedules].append({
            'route_id': route_id,
            'route_name': route_name,
            'num_schedules': num_schedules,
            'total_weeks': total_weeks,
            'schedule_week_counts': schedule_week_counts,
            'dominant_pct': dominant_pct,
            'signatures': schedule_signatures,
        })

    # Print summary statistics
    print(f"\n{'─'*70}")
    print("DISTRIBUTION PATTERNS BY NUMBER OF SCHEDULES")
    print(f"{'─'*70}")

    for num_schedules in sorted(routes_by_schedule_count.keys()):
        route_list = routes_by_schedule_count[num_schedules]
        print(f"\n{num_schedules}-Schedule Routes ({len(route_list)} routes):")

        # Calculate statistics
        dominant_percentages = [r['dominant_pct'] for r in route_list]
        avg_dominant_pct = sum(dominant_percentages) / len(dominant_percentages)
        min_dominant_pct = min(dominant_percentages)
        max_dominant_pct = max(dominant_percentages)

        print(f"  Dominant schedule covers:")
        print(f"    Average: {avg_dominant_pct:.1f}% of weeks")
        print(f"    Range:   {min_dominant_pct:.1f}% - {max_dominant_pct:.1f}%")

        # Count how many have a clear dominant schedule (>60% of weeks)
        clear_dominant = sum(1 for r in route_list if r['dominant_pct'] >= 60)
        somewhat_dominant = sum(1 for r in route_list if 40 <= r['dominant_pct'] < 60)
        balanced = sum(1 for r in route_list if r['dominant_pct'] < 40)

        print(f"  Distribution:")
        print(f"    Clear dominant (≥60%):    {clear_dominant:3d} ({clear_dominant/len(route_list)*100:5.1f}%)")
        print(f"    Somewhat dominant (40-60%): {somewhat_dominant:3d} ({somewhat_dominant/len(route_list)*100:5.1f}%)")
        print(f"    Balanced (<40%):           {balanced:3d} ({balanced/len(route_list)*100:5.1f}%)")

        # Show examples
        if num_schedules <= 4:
            print(f"\n  Examples (showing week distribution):")
            for r in sorted(route_list, key=lambda x: x['dominant_pct'], reverse=True)[:5]:
                counts = r['schedule_week_counts']
                distribution_str = " / ".join([f"{c}w" for c in counts])
                print(f"    {r['route_name']:25s} {r['total_weeks']:2d} weeks: {distribution_str} ({r['dominant_pct']:.0f}% dominant)")

    # Detailed analysis of 2-schedule routes (most interesting)
    print(f"\n{'─'*70}")
    print("DETAILED ANALYSIS: 2-SCHEDULE ROUTES")
    print(f"{'─'*70}")

    two_schedule_routes = routes_by_schedule_count.get(2, [])
    if two_schedule_routes:
        print(f"\nTotal 2-schedule routes: {len(two_schedule_routes)}")

        # Categorize by split
        highly_dominant = [r for r in two_schedule_routes if r['dominant_pct'] >= 80]  # e.g., 20w/2w
        moderately_dominant = [r for r in two_schedule_routes if 60 <= r['dominant_pct'] < 80]  # e.g., 14w/8w
        near_even = [r for r in two_schedule_routes if r['dominant_pct'] < 60]  # e.g., 12w/10w

        print(f"\nBy dominance:")
        print(f"  Highly dominant (≥80%):       {len(highly_dominant):3d} ({len(highly_dominant)/len(two_schedule_routes)*100:5.1f}%)")
        print(f"  Moderately dominant (60-80%): {len(moderately_dominant):3d} ({len(moderately_dominant)/len(two_schedule_routes)*100:5.1f}%)")
        print(f"  Near-even split (<60%):       {len(near_even):3d} ({len(near_even)/len(two_schedule_routes)*100:5.1f}%)")

        # Show examples from each category
        if highly_dominant:
            print(f"\n  Highly dominant examples:")
            for r in highly_dominant[:5]:
                counts = r['schedule_week_counts']
                print(f"    {r['route_name']:25s} {counts[0]}w dominant, {counts[1]}w secondary")

        if near_even:
            print(f"\n  Near-even split examples:")
            for r in near_even[:5]:
                counts = r['schedule_week_counts']
                print(f"    {r['route_name']:25s} {counts[0]}w vs {counts[1]}w ({r['dominant_pct']:.0f}% / {100-r['dominant_pct']:.0f}%)")

    # Overall summary
    print(f"\n{'─'*70}")
    print("KEY FINDINGS")
    print(f"{'─'*70}")

    all_multi_schedule = []
    for route_list in routes_by_schedule_count.values():
        all_multi_schedule.extend(route_list)

    if all_multi_schedule:
        clear_dominant_total = sum(1 for r in all_multi_schedule if r['dominant_pct'] >= 60)
        pct_clear_dominant = (clear_dominant_total / len(all_multi_schedule)) * 100

        print(f"\nAcross all multi-schedule routes:")
        print(f"  Total routes: {len(all_multi_schedule)}")
        print(f"  Routes with clear dominant schedule (≥60%): {clear_dominant_total} ({pct_clear_dominant:.1f}%)")

        if pct_clear_dominant >= 70:
            print(f"\n✓ GOOD NEWS: Most multi-schedule routes have a dominant schedule")
            print(f"  Strategy: Publish dominant schedule with note about exceptions")
        elif pct_clear_dominant >= 50:
            print(f"\n→ MIXED: About half have a dominant schedule")
            print(f"  Strategy: Consider segmenting by route importance")
        else:
            print(f"\n⚠️  COMPLEX: Many routes don't have a clear dominant schedule")
            print(f"  Strategy: May need multiple schedule versions or date-specific queries")

    return routes_by_schedule_count

def main():
    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    print("Reading Rail GTFS data...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    analyze_rail_schedule_distribution(rail_feed)

if __name__ == "__main__":
    main()
