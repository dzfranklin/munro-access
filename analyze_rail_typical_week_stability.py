#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Key question: If I pick a typical (non-exceptional) week, will most other
typical weeks have very similar patterns?

This checks if the "dominant schedule" is actually a single stable pattern,
or if it's many different patterns grouped together.
"""

import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd

# Configuration
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")

def analyze_typical_week_stability(feed):
    """Check if typical weeks are truly stable."""
    print(f"\n{'='*70}")
    print(f"  Typical Week Stability Analysis")
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
    print(f"\nData range: {min_date} to {max_date}")

    # Merge trips with calendar and stop_times for actual departure counts
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')

    # Count departures per trip (one trip can have many stops/departures)
    trip_departure_counts = stop_times.groupby('trip_id').size().to_dict()

    # Build week-by-week detailed patterns per route
    route_weekly_data = defaultdict(lambda: {
        'route_name': None,
        'weeks': defaultdict(lambda: {
            'service_ids': set(),
            'weekday_pattern': None,
            'total_departures': 0,  # Actual number of departures
            'trip_ids': set(),
        })
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    print(f"\nBuilding detailed week-by-week service patterns...")

    for _, trip in trips_with_cal.iterrows():
        if pd.isna(trip.get('start_date')) or pd.isna(trip.get('end_date')):
            continue

        route_id = trip['route_id']
        trip_id = trip['trip_id']
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

            # Get departure count for this trip
            departure_count = trip_departure_counts.get(trip_id, 1)

            # Enumerate all weeks this trip covers
            current_date = date_start
            weekday_pattern = tuple(int(trip[day]) if pd.notna(trip.get(day)) else 0 for day in weekday_cols)

            while current_date <= date_end:
                week_key = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"

                route_weekly_data[route_id]['weeks'][week_key]['service_ids'].add(service_id)
                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern
                route_weekly_data[route_id]['weeks'][week_key]['total_departures'] += departure_count
                route_weekly_data[route_id]['weeks'][week_key]['trip_ids'].add(trip_id)

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze stability
    print(f"\nAnalyzing typical week stability...")

    results = {
        'fully_stable': [],           # All weeks identical
        'stable_with_exceptions': [], # Most weeks identical, few exceptions
        'multiple_patterns': [],      # Multiple distinct patterns, no clear typical
    }

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) < 3:  # Need at least 3 weeks to assess stability
            continue

        # Create detailed signature for each week
        # Signature = (weekday_pattern, service_ids tuple, approx departures)
        week_signatures = {}
        for week_key, week_data in weeks.items():
            pattern = week_data['weekday_pattern']
            service_ids = frozenset(week_data['service_ids'])
            departures = week_data['total_departures']

            # Use exact service_ids for most precise matching
            signature = (pattern, service_ids)
            week_signatures[week_key] = signature

        # Count occurrences of each signature
        signature_counts = Counter(week_signatures.values())

        # Find the most common signature (the "typical" pattern)
        most_common_sig, most_common_count = signature_counts.most_common(1)[0]
        total_weeks = len(weeks)
        typical_pct = (most_common_count / total_weeks) * 100

        # Get weeks with the typical pattern
        typical_weeks = [w for w, sig in week_signatures.items() if sig == most_common_sig]
        exceptional_weeks = [w for w, sig in week_signatures.items() if sig != most_common_sig]

        # Count how many distinct exceptional patterns
        exceptional_signatures = set(sig for sig in week_signatures.values() if sig != most_common_sig)
        num_exceptional_patterns = len(exceptional_signatures)

        record = {
            'route_id': route_id,
            'route_name': route_name,
            'total_weeks': total_weeks,
            'typical_weeks': most_common_count,
            'typical_pct': typical_pct,
            'exceptional_weeks': len(exceptional_weeks),
            'num_exceptional_patterns': num_exceptional_patterns,
            'typical_week_list': sorted(typical_weeks),
            'exceptional_week_list': sorted(exceptional_weeks),
        }

        # Categorize
        if typical_pct == 100:
            results['fully_stable'].append(record)
        elif typical_pct >= 80 and num_exceptional_patterns <= 3:
            results['stable_with_exceptions'].append(record)
        else:
            results['multiple_patterns'].append(record)

    # Print results
    total_routes = sum(len(results[k]) for k in results.keys())

    print(f"\n{'─'*70}")
    print("TYPICAL WEEK STABILITY RESULTS")
    print(f"{'─'*70}")
    print(f"Total routes with ≥3 weeks: {total_routes}")

    fully_stable = len(results['fully_stable'])
    stable_with_exc = len(results['stable_with_exceptions'])
    multiple = len(results['multiple_patterns'])

    print(f"\n  Fully stable (100% identical):         {fully_stable:3d} ({fully_stable/total_routes*100:5.1f}%)")
    print(f"  Stable with exceptions (≥80% typical): {stable_with_exc:3d} ({stable_with_exc/total_routes*100:5.1f}%)")
    print(f"  Multiple patterns (no clear typical):  {multiple:3d} ({multiple/total_routes*100:5.1f}%)")

    publishable = fully_stable + stable_with_exc
    print(f"\n✓ Publishable (stable typical week): {publishable:3d} ({publishable/total_routes*100:5.1f}%)")
    print(f"⚠️  Not publishable (no typical week): {multiple:3d} ({multiple/total_routes*100:5.1f}%)")

    # Show examples
    print(f"\n{'─'*70}")
    print("EXAMPLES")
    print(f"{'─'*70}")

    if results['stable_with_exceptions']:
        print(f"\nStable with exceptions (first 10):")
        for r in sorted(results['stable_with_exceptions'], key=lambda x: x['total_weeks'], reverse=True)[:10]:
            print(f"  {r['route_name']:25s} {r['total_weeks']:2d} weeks: {r['typical_weeks']:2d} typical, {r['exceptional_weeks']} exceptional ({r['num_exceptional_patterns']} patterns)")
            if r['exceptional_weeks'] <= 5:
                exc_weeks = ', '.join(r['exceptional_week_list'])
                print(f"    Exceptional weeks: {exc_weeks}")

    if results['multiple_patterns']:
        print(f"\nMultiple patterns (first 10):")
        for r in sorted(results['multiple_patterns'], key=lambda x: x['typical_pct'], reverse=True)[:10]:
            print(f"  {r['route_name']:25s} {r['total_weeks']:2d} weeks: {r['typical_weeks']:2d} typical ({r['typical_pct']:.0f}%), {r['exceptional_weeks']} other")

    # Key insight about exceptional weeks
    if results['stable_with_exceptions']:
        print(f"\n{'─'*70}")
        print("EXCEPTIONAL WEEK PATTERNS")
        print(f"{'─'*70}")

        # Collect all exceptional weeks across routes
        all_exceptional_weeks = Counter()
        for r in results['stable_with_exceptions']:
            for week in r['exceptional_week_list']:
                all_exceptional_weeks[week] += 1

        print(f"\nMost common exceptional weeks (likely holidays):")
        for week, count in all_exceptional_weeks.most_common(10):
            print(f"  {week}: {count} routes have exceptions this week")

        print(f"\nInsight: If exceptional weeks cluster around specific dates,")
        print(f"  you can publish with date ranges: 'Valid except Christmas week'")

    return results

def main():
    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    print("Reading Rail GTFS data...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    results = analyze_typical_week_stability(rail_feed)

    print(f"\n{'='*70}")
    print("CONCLUSION")
    print(f"{'='*70}")

    total = sum(len(results[k]) for k in results.keys())
    publishable = len(results['fully_stable']) + len(results['stable_with_exceptions'])

    if publishable / total >= 0.8:
        print(f"\n✓ EXCELLENT: {publishable/total*100:.1f}% of routes have a stable typical week")
        print(f"  → You CAN publish a single analysis per day-of-week")
        print(f"  → Add disclaimer about exceptional weeks (Christmas, etc)")
        print(f"  → Most users will get accurate results year-round")
    elif publishable / total >= 0.6:
        print(f"\n→ GOOD: {publishable/total*100:.1f}% of routes have a stable typical week")
        print(f"  → You can publish for most routes")
        print(f"  → May need to flag or exclude problematic routes")
    else:
        print(f"\n⚠️  PROBLEMATIC: Only {publishable/total*100:.1f}% have a stable typical week")
        print(f"  → Consider date-specific queries or multiple schedule versions")

if __name__ == "__main__":
    main()
