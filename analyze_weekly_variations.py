#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Analyze how common it is for routes to have different schedules across different weeks.
This requires full (untrimmed) GTFS data, to setup for this run
```bash
SKIP_TRIM=1 data_sources/bus_timetable/download.sh
SKIP_TRIM=1 data_sources/rail_timetable/download.sh
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

def get_week_number(date_str):
    """Convert GTFS date string (YYYYMMDD) to week number."""
    year = int(date_str[:4])
    month = int(date_str[4:6])
    day = int(date_str[6:8])
    date = datetime(year, month, day)
    # Get ISO week number
    return date.isocalendar()[1]

def get_week_key(date_str):
    """Convert GTFS date string to a year-week key."""
    year = int(date_str[:4])
    month = int(date_str[4:6])
    day = int(date_str[6:8])
    date = datetime(year, month, day)
    iso_cal = date.isocalendar()
    return f"{iso_cal[0]}-W{iso_cal[1]:02d}"

def analyze_weekly_patterns(feed, name):
    """Analyze schedule variations across weeks for routes in a GTFS feed."""
    print(f"\n=== Analyzing {name} GTFS ===")

    routes = feed.routes
    trips = feed.trips
    calendar = feed.calendar
    calendar_dates = feed.calendar_dates

    if calendar is None or calendar.empty:
        print(f"Warning: {name} GTFS has no calendar data, cannot analyze")
        return None

    print(f"Total routes: {len(routes)}")
    print(f"Total trips: {len(trips)}")
    print(f"Total service patterns: {len(calendar)}")

    # Get date range
    start_dates = calendar['start_date'].tolist()
    end_dates = calendar['end_date'].tolist()
    min_date = min(start_dates)
    max_date = max(end_dates)

    print(f"Service date range: {min_date} to {max_date}")

    # Check if data spans multiple weeks
    min_week = get_week_key(min_date)
    max_week = get_week_key(max_date)
    print(f"Week range: {min_week} to {max_week}")

    if min_week == max_week:
        print(f"\n⚠️  {name} GTFS is trimmed to a single week!")
        print("To analyze weekly variations, re-download with: SKIP_TRIM=1 ./download_timetables.sh")
        return None

    # Merge trips with calendar
    trips_with_service = trips.merge(calendar, on='service_id', how='left')

    # For each route, track which weeks it operates in and with what patterns
    route_weekly_patterns = defaultdict(lambda: {
        'weeks': set(),
        'service_patterns': {},  # week -> set of service_ids
        'route_name': None
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    for _, row in trips_with_service.iterrows():
        if pd.isna(row.get('start_date')) or pd.isna(row.get('end_date')):
            continue

        route_id = row['route_id']
        service_id = row['service_id']
        start_date = str(int(row['start_date']))
        end_date = str(int(row['end_date']))

        # Get route name
        if route_weekly_patterns[route_id]['route_name'] is None:
            route_name = routes[routes['route_id'] == route_id]['route_short_name'].values
            if len(route_name) > 0:
                route_weekly_patterns[route_id]['route_name'] = route_name[0]

        # Determine which weeks this service covers
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

            # Enumerate all weeks between start and end
            current_date = date_start
            weeks_covered = set()

            while current_date <= date_end:
                week_key = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"
                weeks_covered.add(week_key)
                # Jump to next week (move to next Monday)
                current_date += timedelta(days=7 - current_date.weekday())

            # Create pattern signature once
            pattern = tuple(int(row[day]) if pd.notna(row.get(day)) else 0 for day in weekday_cols)

            # Track this service pattern for all weeks it covers
            for week in weeks_covered:
                route_weekly_patterns[route_id]['weeks'].add(week)
                if week not in route_weekly_patterns[route_id]['service_patterns']:
                    route_weekly_patterns[route_id]['service_patterns'][week] = set()
                route_weekly_patterns[route_id]['service_patterns'][week].add((service_id, pattern))
        except (ValueError, KeyError):
            continue

    # Analyze patterns
    results = {
        'single_week_only': 0,
        'uniform_across_weeks': 0,
        'varying_across_weeks': 0,
        'no_data': 0,
    }

    examples = {
        'uniform_across_weeks': [],
        'varying_across_weeks': [],
    }

    for route_id, data in route_weekly_patterns.items():
        weeks = data['weeks']
        patterns_by_week = data['service_patterns']
        route_name = data['route_name']

        if len(weeks) == 0:
            results['no_data'] += 1
            continue

        if len(weeks) == 1:
            results['single_week_only'] += 1
            continue

        # Check if all weeks have the same service patterns
        pattern_sets = [frozenset(patterns_by_week[week]) for week in weeks if week in patterns_by_week]

        if len(set(pattern_sets)) == 1:
            # All weeks have identical service patterns
            results['uniform_across_weeks'] += 1
            if len(examples['uniform_across_weeks']) < 3:
                examples['uniform_across_weeks'].append(
                    f"{route_name} (route_id: {route_id}, {len(weeks)} weeks)"
                )
        else:
            # Different patterns across weeks
            results['varying_across_weeks'] += 1
            if len(examples['varying_across_weeks']) < 5:
                week_list = sorted(weeks)[:3]
                examples['varying_across_weeks'].append(
                    f"{route_name} (route_id: {route_id}, {len(weeks)} weeks, patterns vary)"
                )

    # Print results
    total = results['uniform_across_weeks'] + results['varying_across_weeks']
    if total == 0:
        print(f"\n⚠️  No multi-week routes found in {name} GTFS")
        return results

    print(f"\n--- {name} Multi-Week Route Analysis ---")
    print(f"Routes operating only one week: {results['single_week_only']}")
    print(f"\nMulti-week routes:")
    print(f"  Uniform across weeks: {results['uniform_across_weeks']} ({results['uniform_across_weeks']/total*100:.1f}%)")
    if examples['uniform_across_weeks']:
        for ex in examples['uniform_across_weeks']:
            print(f"    - {ex}")

    print(f"  Varying across weeks: {results['varying_across_weeks']} ({results['varying_across_weeks']/total*100:.1f}%)")
    if examples['varying_across_weeks']:
        for ex in examples['varying_across_weeks']:
            print(f"    - {ex}")

    print(f"\nNo data: {results['no_data']}")

    return results

def main():
    # Check files exist
    if not BUS_GTFS.exists():
        print(f"ERROR: Bus GTFS file not found: {BUS_GTFS}", file=sys.stderr)
        print("Have you run ./download_timetables.sh?", file=sys.stderr)
        sys.exit(1)

    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS file not found: {RAIL_GTFS}", file=sys.stderr)
        print("Have you run ./download_timetables.sh?", file=sys.stderr)
        sys.exit(1)

    # Analyze bus GTFS
    print("Reading bus GTFS...")
    bus_feed = gk.read_feed(str(BUS_GTFS), dist_units='km')
    bus_results = analyze_weekly_patterns(bus_feed, "Bus")

    # Analyze rail GTFS
    print("\nReading rail GTFS...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')
    rail_results = analyze_weekly_patterns(rail_feed, "Rail")

    # Summary
    print("\n=== SUMMARY ===")
    if bus_results is None or rail_results is None:
        print("Analysis incomplete - data appears to be trimmed to a single week.")
        print("To analyze weekly variations, re-download with:")
        print("  SKIP_TRIM=1 ./download_timetables.sh")
    else:
        print("Analysis complete!")
        print("Many routes have different schedules across weeks (e.g., seasonal changes,")
        print("special events, or temporary service adjustments).")

if __name__ == "__main__":
    main()
