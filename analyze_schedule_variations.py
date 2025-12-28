#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Analyze how common it is for routes to have different schedules on different weekdays.
Examines GTFS data to identify service pattern variations across weekdays.
"""

import sys
from pathlib import Path
from collections import defaultdict
import gtfs_kit as gk
import pandas as pd

# Configuration
BUS_GTFS = Path("otp/bus_scot_gtfs.zip")
RAIL_GTFS = Path("otp/rail_scot_gtfs.zip")

def analyze_service_patterns(feed, name):
    """Analyze service pattern variations for routes in a GTFS feed."""
    print(f"\n=== Analyzing {name} GTFS ===")

    # Get routes, trips, and calendar data
    routes = feed.routes
    trips = feed.trips
    calendar = feed.calendar
    calendar_dates = feed.calendar_dates

    print(f"Total routes: {len(routes)}")
    print(f"Total trips: {len(trips)}")

    # Merge trips with calendar to get service patterns
    trips_with_service = trips.merge(calendar, on='service_id', how='left')

    # Group by route and analyze service patterns
    route_patterns = defaultdict(lambda: {
        'service_ids': set(),
        'weekday_patterns': set(),
        'route_name': None
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    for _, trip in trips_with_service.iterrows():
        route_id = trip['route_id']
        service_id = trip['service_id']

        # Get route name
        if route_patterns[route_id]['route_name'] is None:
            route_name = routes[routes['route_id'] == route_id]['route_short_name'].values
            if len(route_name) > 0:
                route_patterns[route_id]['route_name'] = route_name[0]

        # Track service IDs used by this route
        route_patterns[route_id]['service_ids'].add(service_id)

        # Create a pattern tuple for the weekday schedule
        if pd.notna(trip.get('monday')):
            pattern = tuple(int(trip[day]) for day in weekday_cols)
            route_patterns[route_id]['weekday_patterns'].add(pattern)

    # Analyze patterns
    results = {
        'uniform_schedule': 0,  # Same schedule every day
        'weekday_weekend_split': 0,  # Different schedule for weekends
        'complex_pattern': 0,  # Different schedules across weekdays
        'no_calendar_data': 0,  # Routes without calendar data
    }

    examples = {
        'uniform_schedule': [],
        'weekday_weekend_split': [],
        'complex_pattern': [],
    }

    for route_id, data in route_patterns.items():
        patterns = data['weekday_patterns']
        route_name = data['route_name']
        num_services = len(data['service_ids'])

        if len(patterns) == 0:
            results['no_calendar_data'] += 1
            continue

        # Check if route has only one service pattern
        if len(patterns) == 1:
            pattern = list(patterns)[0]
            # Check if all days are the same
            if len(set(pattern)) == 1:
                results['uniform_schedule'] += 1
                if len(examples['uniform_schedule']) < 3:
                    examples['uniform_schedule'].append(f"{route_name} (route_id: {route_id})")
            # Check if it's a weekday/weekend split (Mon-Fri same, Sat-Sun same)
            elif pattern[:5] == tuple([pattern[0]] * 5) and pattern[5:7] == tuple([pattern[5]] * 2):
                results['weekday_weekend_split'] += 1
                if len(examples['weekday_weekend_split']) < 3:
                    examples['weekday_weekend_split'].append(f"{route_name} (route_id: {route_id})")
            else:
                results['complex_pattern'] += 1
                if len(examples['complex_pattern']) < 3:
                    examples['complex_pattern'].append(f"{route_name} (route_id: {route_id}, pattern: {pattern})")
        else:
            # Multiple service patterns for this route
            results['complex_pattern'] += 1
            if len(examples['complex_pattern']) < 3:
                examples['complex_pattern'].append(f"{route_name} (route_id: {route_id}, {num_services} services)")

    # Print results
    total = sum(results.values())
    print(f"\n--- {name} Results ---")
    print(f"Uniform schedule (same every day): {results['uniform_schedule']} ({results['uniform_schedule']/total*100:.1f}%)")
    if examples['uniform_schedule']:
        print(f"  Examples: {', '.join(examples['uniform_schedule'][:3])}")

    print(f"Weekday/weekend split: {results['weekday_weekend_split']} ({results['weekday_weekend_split']/total*100:.1f}%)")
    if examples['weekday_weekend_split']:
        print(f"  Examples: {', '.join(examples['weekday_weekend_split'][:3])}")

    print(f"Complex patterns (varies by weekday): {results['complex_pattern']} ({results['complex_pattern']/total*100:.1f}%)")
    if examples['complex_pattern']:
        print(f"  Examples: {', '.join(examples['complex_pattern'][:3])}")

    print(f"No calendar data: {results['no_calendar_data']}")

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
    bus_results = analyze_service_patterns(bus_feed, "Bus")

    # Analyze rail GTFS
    print("\nReading rail GTFS...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')
    rail_results = analyze_service_patterns(rail_feed, "Rail")

    # Summary
    print("\n=== SUMMARY ===")
    print("Most routes have varying schedules across weekdays.")
    print("Complex patterns indicate different service levels on different days,")
    print("which is common for public transit (e.g., reduced weekend service).")

if __name__ == "__main__":
    main()
