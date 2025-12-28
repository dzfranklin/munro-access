#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Test hypothesis: "pattern changes" are actually just a few distinct schedules
(e.g., standard, school holidays, Christmas) that repeat predictably.
"""

import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd

# Configuration
BUS_GTFS = Path("data_sources/bus_timetable/out/bus_scot_gtfs.zip")
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")

def analyze_schedule_clustering(feed, name):
    """Check if pattern changes are actually a small set of distinct schedules."""
    print(f"\n{'='*70}")
    print(f"  {name} GTFS - Schedule Clustering Analysis")
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
                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern
                route_weekly_data[route_id]['weeks'][week_key]['trip_count'] += 1

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze clustering
    print(f"\nAnalyzing schedule patterns...")

    # Track global pattern statistics
    global_pattern_counts = Counter()
    routes_with_multiple_patterns = []

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) < 2:
            continue

        # For each route, count how many distinct "schedules" it has
        # A schedule = combination of (weekday_pattern, approximate trip count)

        # Group weeks by their service signature
        schedule_signatures = defaultdict(list)  # signature -> list of weeks

        for week_key, week_data in weeks.items():
            # Create signature from weekday pattern and trip count (rounded to buckets)
            pattern = week_data['weekday_pattern']
            trip_count = week_data['trip_count']

            # Bucket trip counts to handle minor variations
            trip_bucket = round(trip_count / 5) * 5  # Round to nearest 5

            signature = (pattern, trip_bucket)
            schedule_signatures[signature].append(week_key)

        num_schedules = len(schedule_signatures)
        global_pattern_counts[num_schedules] += 1

        if num_schedules > 1:
            # Calculate how weeks are distributed across schedules
            schedule_distribution = sorted(
                [(sig, len(weeks)) for sig, weeks in schedule_signatures.items()],
                key=lambda x: x[1],
                reverse=True
            )

            routes_with_multiple_patterns.append({
                'route_id': route_id,
                'route_name': route_name,
                'num_schedules': num_schedules,
                'total_weeks': len(weeks),
                'schedule_distribution': schedule_distribution,
                'signatures': schedule_signatures,
            })

    # Print results
    total_routes = sum(global_pattern_counts.values())

    print(f"\n{'─'*70}")
    print("HOW MANY DISTINCT SCHEDULES PER ROUTE?")
    print(f"{'─'*70}")
    print(f"Total multi-week routes: {total_routes}")

    for num_schedules in sorted(global_pattern_counts.keys()):
        count = global_pattern_counts[num_schedules]
        pct = count / total_routes * 100
        print(f"  {num_schedules} distinct schedule(s): {count:4d} ({pct:5.1f}%)")

    # Key insight
    print(f"\n{'─'*70}")
    print("KEY INSIGHT")
    print(f"{'─'*70}")

    if global_pattern_counts[1] > total_routes * 0.7:
        print("✓ Most routes have a SINGLE schedule - very stable!")
    elif global_pattern_counts[2] > total_routes * 0.3:
        print("→ Many routes have exactly TWO schedules")
        print("  This likely means: Standard + Holiday/Reduced service")
    elif global_pattern_counts[3] > total_routes * 0.2:
        print("→ Many routes have THREE schedules")
        print("  This likely means: Standard + School Holidays + Christmas/Special")
    else:
        print("⚠️  Routes have many different schedules - more complex variation")

    # Analyze routes with multiple patterns
    if routes_with_multiple_patterns:
        print(f"\n{'─'*70}")
        print("ROUTES WITH MULTIPLE SCHEDULES (examples)")
        print(f"{'─'*70}")

        # Sort by number of schedules
        routes_with_multiple_patterns.sort(key=lambda x: x['num_schedules'], reverse=True)

        # Show examples of 2-schedule routes (most interesting for holiday hypothesis)
        two_schedule_routes = [r for r in routes_with_multiple_patterns if r['num_schedules'] == 2]
        three_schedule_routes = [r for r in routes_with_multiple_patterns if r['num_schedules'] == 3]

        if two_schedule_routes:
            print(f"\nRoutes with EXACTLY 2 schedules (first 5):")
            for r in two_schedule_routes[:5]:
                dist = r['schedule_distribution']
                print(f"  {r['route_name']}:")
                print(f"    Schedule A: {dist[0][1]} weeks")
                print(f"    Schedule B: {dist[1][1]} weeks")

                # Show what the patterns are
                sig_a, sig_b = dist[0][0], dist[1][0]
                pattern_a, trips_a = sig_a
                pattern_b, trips_b = sig_b

                days_a = [d for i, d in enumerate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) if pattern_a[i]]
                days_b = [d for i, d in enumerate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) if pattern_b[i]]

                print(f"    Pattern A: {', '.join(days_a) if days_a else 'No service'} (~{trips_a} trips)")
                print(f"    Pattern B: {', '.join(days_b) if days_b else 'No service'} (~{trips_b} trips)")

        if three_schedule_routes:
            print(f"\nRoutes with EXACTLY 3 schedules (first 3):")
            for r in three_schedule_routes[:3]:
                dist = r['schedule_distribution']
                print(f"  {r['route_name']}:")
                for idx, (sig, week_count) in enumerate(dist):
                    pattern, trips = sig
                    days = [d for i, d in enumerate(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) if pattern[i]]
                    print(f"    Schedule {chr(65+idx)}: {week_count} weeks, {', '.join(days) if days else 'No service'} (~{trips} trips)")

    # Check for temporal clustering - are schedules seasonal?
    print(f"\n{'─'*70}")
    print("TEMPORAL DISTRIBUTION")
    print(f"{'─'*70}")
    print("Checking if schedules cluster in time (e.g., school holidays)...")

    # For routes with 2 schedules, check if schedule B clusters in specific weeks
    if two_schedule_routes:
        example_route = two_schedule_routes[0]
        print(f"\nExample: {example_route['route_name']}")

        signatures = example_route['signatures']
        dist = example_route['schedule_distribution']

        # Get the two schedules
        sig_a = dist[0][0]
        sig_b = dist[1][0]

        weeks_a = sorted(signatures[sig_a])
        weeks_b = sorted(signatures[sig_b])

        print(f"  Schedule A weeks: {', '.join(weeks_a[:5])}{'...' if len(weeks_a) > 5 else ''}")
        print(f"  Schedule B weeks: {', '.join(weeks_b[:5])}{'...' if len(weeks_b) > 5 else ''}")

        # Check if schedule B is contiguous
        if len(weeks_b) >= 2:
            # Parse week numbers to check continuity
            try:
                week_nums_b = [int(w.split('-W')[1]) for w in weeks_b]
                gaps = [week_nums_b[i+1] - week_nums_b[i] for i in range(len(week_nums_b)-1)]
                avg_gap = sum(gaps) / len(gaps) if gaps else 0

                if avg_gap <= 1.5:
                    print(f"  → Schedule B appears CONTIGUOUS (avg gap: {avg_gap:.1f} weeks)")
                    print(f"  → Likely represents a continuous period (e.g., school holidays)")
                else:
                    print(f"  → Schedule B is SCATTERED (avg gap: {avg_gap:.1f} weeks)")
                    print(f"  → May represent weekly variations or multiple holiday periods")
            except:
                pass

    return {
        'pattern_counts': global_pattern_counts,
        'total_routes': total_routes,
        'two_schedule_routes': len(two_schedule_routes) if two_schedule_routes else 0,
        'three_schedule_routes': len(three_schedule_routes) if three_schedule_routes else 0,
    }

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

    bus_results = analyze_schedule_clustering(bus_feed, "Bus")
    rail_results = analyze_schedule_clustering(rail_feed, "Rail")

    print(f"\n{'='*70}")
    print("CONCLUSION")
    print(f"{'='*70}")

    print("\nIf most routes have 1-3 distinct schedules:")
    print("  ✓ Your hypothesis is correct!")
    print("  ✓ You can publish with schedule type labels (Standard/Holiday/etc)")
    print("  ✓ Users select which schedule applies to their travel date")
    print("\nIf routes have many schedules:")
    print("  ⚠️  More complex - may need date-specific queries")

if __name__ == "__main__":
    main()
