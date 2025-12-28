#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
#   "requests",
#   "icalendar",
# ]
# ///
"""
Deep dive into a single complex route to understand its timetable variations.
"""

import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd
import requests
from icalendar import Calendar

# Configuration
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")
SCOTLAND_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays/scotland.ics"

def fetch_scotland_bank_holidays():
    """Fetch and parse Scotland bank holidays from government ICS."""
    response = requests.get(SCOTLAND_BANK_HOLIDAYS_URL, timeout=10)
    response.raise_for_status()
    cal = Calendar.from_ical(response.content)

    bank_holidays = []
    for component in cal.walk():
        if component.name == "VEVENT":
            dt = component.get('dtstart').dt
            summary = str(component.get('summary'))
            bank_holidays.append({'date': dt, 'name': summary})

    return bank_holidays

def get_week_key(date):
    """Convert date to week key."""
    iso = date.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"

def analyze_single_route(feed, route_name_pattern, bank_holidays):
    """Deep dive into a single route's timetable variations."""
    print(f"\n{'='*70}")
    print(f"  Detailed Analysis: Routes matching '{route_name_pattern}'")
    print(f"{'='*70}")

    routes = feed.routes
    trips = feed.trips
    calendar = feed.calendar
    stop_times = feed.stop_times

    # Find routes matching pattern
    matching_routes = routes[routes['route_short_name'].str.contains(route_name_pattern, case=False, na=False)]

    if len(matching_routes) == 0:
        print(f"No routes found matching '{route_name_pattern}'")
        return

    print(f"\nFound {len(matching_routes)} matching route(s):")
    for _, route in matching_routes.iterrows():
        print(f"  - {route['route_short_name']} (ID: {route['route_id']})")

    # Analyze first matching route
    route_id = matching_routes.iloc[0]['route_id']
    route_name = matching_routes.iloc[0]['route_short_name']

    print(f"\n{'─'*70}")
    print(f"Analyzing route: {route_name} (ID: {route_id})")
    print(f"{'─'*70}")

    # Get bank holiday weeks
    bank_holiday_weeks = set()
    for bh in bank_holidays:
        if isinstance(bh['date'], datetime):
            bh_date = bh['date'].date()
        else:
            bh_date = bh['date']
        week_key = get_week_key(bh_date)
        bank_holiday_weeks.add(week_key)

    # Get all trips for this route
    route_trips = trips[trips['route_id'] == route_id]
    print(f"\nTotal trips defined: {len(route_trips)}")

    # Merge with calendar
    trips_with_cal = route_trips.merge(calendar, on='service_id', how='left')

    # Get departure counts per trip
    trip_departure_counts = stop_times.groupby('trip_id').size().to_dict()

    # Build week-by-week pattern
    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    weekday_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    weekly_data = defaultdict(lambda: {
        'service_ids': set(),
        'trips': [],
        'total_departures': 0,
        'weekday_pattern': None,
    })

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('start_date')) or pd.isna(trip.get('end_date')):
            continue

        trip_id = trip['trip_id']
        service_id = trip['service_id']

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

            departure_count = trip_departure_counts.get(trip_id, 1)

            current_date = date_start
            weekday_pattern = tuple(int(trip[day]) if pd.notna(trip.get(day)) else 0 for day in weekday_cols)

            while current_date <= date_end:
                week_key = get_week_key(current_date)

                weekly_data[week_key]['service_ids'].add(service_id)
                weekly_data[week_key]['trips'].append(trip_id)
                weekly_data[week_key]['total_departures'] += departure_count
                weekly_data[week_key]['weekday_pattern'] = weekday_pattern

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze patterns
    print(f"\nWeeks covered: {len(weekly_data)}")

    # Create signatures and group weeks
    week_signatures = {}
    for week_key, week_data in weekly_data.items():
        sig = (week_data['weekday_pattern'], frozenset(week_data['service_ids']))
        week_signatures[week_key] = sig

    # Group by signature
    signature_groups = defaultdict(list)
    for week_key, sig in week_signatures.items():
        signature_groups[sig].append(week_key)

    # Sort groups by size
    sorted_groups = sorted(
        [(sig, weeks_list) for sig, weeks_list in signature_groups.items()],
        key=lambda x: len(x[1]),
        reverse=True
    )

    print(f"\nDistinct timetable patterns: {len(sorted_groups)}")

    # Print each pattern in detail
    for idx, (sig, weeks_list) in enumerate(sorted_groups, 1):
        pattern, service_ids = sig
        weeks_list = sorted(weeks_list)

        print(f"\n{'─'*70}")
        print(f"PATTERN {idx}: {len(weeks_list)} weeks")
        print(f"{'─'*70}")

        # Show which weeks
        if len(weeks_list) <= 10:
            print(f"Weeks: {', '.join(weeks_list)}")
        else:
            print(f"Weeks: {weeks_list[0]} to {weeks_list[-1]} ({len(weeks_list)} total)")
            print(f"  First 5: {', '.join(weeks_list[:5])}")
            print(f"  Last 5:  {', '.join(weeks_list[-5:])}")

        # Mark bank holiday weeks
        bh_weeks = [w for w in weeks_list if w in bank_holiday_weeks]
        if bh_weeks:
            print(f"  (Includes {len(bh_weeks)} bank holiday weeks: {', '.join(bh_weeks[:3])}{'...' if len(bh_weeks) > 3 else ''})")

        # Show service pattern
        days_active = [weekday_names[i] for i, active in enumerate(pattern) if active]
        if days_active:
            print(f"Days: {', '.join(days_active)}")
        else:
            print(f"Days: No service")

        # Get example week data
        example_week = weeks_list[0]
        example_data = weekly_data[example_week]
        print(f"Total departures/week: {example_data['total_departures']}")
        print(f"Service IDs: {', '.join(sorted(service_ids))}")
        print(f"Number of trips: {len(set(example_data['trips']))}")

        # Show temporal contiguity
        if len(weeks_list) > 1:
            # Check if contiguous
            week_nums = []
            for w in weeks_list:
                try:
                    year = int(w.split('-W')[0])
                    week = int(w.split('-W')[1])
                    week_nums.append(year * 100 + week)
                except:
                    continue

            week_nums = sorted(week_nums)
            gaps = []
            for i in range(len(week_nums) - 1):
                diff = week_nums[i+1] - week_nums[i]
                # Handle year boundary
                if diff >= 49 and diff <= 51:
                    gaps.append(1)
                else:
                    gaps.append(diff)

            if gaps:
                max_gap = max(gaps)
                avg_gap = sum(gaps) / len(gaps)
                if max_gap == 1:
                    print(f"Temporal: CONTIGUOUS BLOCK")
                elif avg_gap <= 1.5:
                    print(f"Temporal: Mostly contiguous (avg gap: {avg_gap:.1f})")
                else:
                    print(f"Temporal: SCATTERED (max gap: {max_gap}, avg gap: {avg_gap:.1f})")

    # Summary
    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")

    non_bh_weeks = [w for w in weekly_data.keys() if w not in bank_holiday_weeks]
    print(f"\nTotal weeks: {len(weekly_data)}")
    print(f"Non-bank-holiday weeks: {len(non_bh_weeks)}")
    print(f"Distinct patterns: {len(sorted_groups)}")

    if len(sorted_groups) <= 3:
        print(f"\n✓ PUBLISHABLE: Route has {len(sorted_groups)} distinct timetable(s)")
        print(f"  Strategy: Publish each pattern with date ranges")
    else:
        print(f"\n⚠️  COMPLEX: Route has {len(sorted_groups)} distinct patterns")
        print(f"  Need to assess if patterns are seasonal or scattered")

def main():
    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    # Fetch bank holidays
    print("Fetching Scotland bank holidays...")
    bank_holidays = fetch_scotland_bank_holidays()

    # Load GTFS
    print("Reading Rail GTFS data...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    # Ask user which route to analyze
    if len(sys.argv) > 1:
        route_pattern = sys.argv[1]
    else:
        # Default to a complex route from previous analysis
        route_pattern = "Glasgow Central"
        print(f"\nNo route specified, analyzing '{route_pattern}'")
        print("Usage: python analyze_single_route_detail.py 'Route Name'")

    analyze_single_route(rail_feed, route_pattern, bank_holidays)

if __name__ == "__main__":
    main()
