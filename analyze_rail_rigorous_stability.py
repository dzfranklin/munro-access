#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
#   "pandas",
# ]
# ///
"""
Rigorous stability analysis that distinguishes:
1. Holiday exceptions (a few specific weeks) - PUBLISHABLE
2. Timetable changeover (old schedule → new schedule) - PUBLISHABLE (need 2 versions)
3. Constant variation (different every week) - NOT PUBLISHABLE

Approach:
- Cluster weeks by exact service pattern
- Identify stable periods (large clusters)
- Check if exceptional weeks are isolated or if stable periods are temporally contiguous
"""

import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import gtfs_kit as gk
import pandas as pd

# Configuration
RAIL_GTFS = Path("data_sources/rail_timetable/out/rail_scot_gtfs.zip")

def analyze_rigorous_stability(feed):
    """Rigorous analysis of schedule stability."""
    print(f"\n{'='*70}")
    print(f"  Rigorous Schedule Stability Analysis")
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

    # Merge trips with calendar
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')

    # Count departures per trip
    trip_departure_counts = stop_times.groupby('trip_id').size().to_dict()

    # Build week-by-week patterns
    route_weekly_data = defaultdict(lambda: {
        'route_name': None,
        'weeks': defaultdict(lambda: {
            'service_ids': frozenset(),
            'weekday_pattern': None,
            'total_departures': 0,
        })
    })

    weekday_cols = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    print(f"\nBuilding week-by-week service patterns...")

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

            departure_count = trip_departure_counts.get(trip_id, 1)

            current_date = date_start
            weekday_pattern = tuple(int(trip[day]) if pd.notna(trip.get(day)) else 0 for day in weekday_cols)

            while current_date <= date_end:
                week_key = f"{current_date.isocalendar()[0]}-W{current_date.isocalendar()[1]:02d}"
                week_num = current_date.isocalendar()[1]

                # Store as mutable dict first, will convert to frozenset later
                if not isinstance(route_weekly_data[route_id]['weeks'][week_key]['service_ids'], frozenset):
                    route_weekly_data[route_id]['weeks'][week_key]['service_ids'] = set()
                else:
                    # Convert back to set if it was frozen
                    route_weekly_data[route_id]['weeks'][week_key]['service_ids'] = set(route_weekly_data[route_id]['weeks'][week_key]['service_ids'])

                route_weekly_data[route_id]['weeks'][week_key]['service_ids'].add(service_id)
                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern
                route_weekly_data[route_id]['weeks'][week_key]['total_departures'] += departure_count
                route_weekly_data[route_id]['weeks'][week_key]['week_num'] = week_num

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Convert sets to frozensets for hashing
    for route_id, data in route_weekly_data.items():
        for week_key, week_data in data['weeks'].items():
            if isinstance(week_data['service_ids'], set):
                week_data['service_ids'] = frozenset(week_data['service_ids'])

    # Analyze each route
    print(f"\nAnalyzing route stability patterns...")

    results = {
        'fully_stable': [],              # Single pattern all year
        'timetable_changeover': [],      # 2 stable periods (old → new timetable)
        'holiday_exceptions': [],        # 1 stable period + isolated exceptions
        'multiple_stable_periods': [],   # 3+ stable periods
        'chaotic': [],                   # No clear stable periods
    }

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) < 3:
            continue

        # Create exact signature for each week
        week_signatures = {}
        for week_key, week_data in weeks.items():
            sig = (week_data['weekday_pattern'], week_data['service_ids'])
            week_signatures[week_key] = sig

        # Cluster weeks by signature
        signature_to_weeks = defaultdict(list)
        for week_key, sig in week_signatures.items():
            signature_to_weeks[sig].append(week_key)

        # Sort clusters by size
        clusters = sorted(
            [(sig, weeks_list) for sig, weeks_list in signature_to_weeks.items()],
            key=lambda x: len(x[1]),
            reverse=True
        )

        num_clusters = len(clusters)
        total_weeks = len(weeks)

        # Analyze cluster characteristics
        largest_cluster_size = len(clusters[0][1])
        largest_cluster_pct = (largest_cluster_size / total_weeks) * 100

        # Check temporal contiguity of clusters
        def is_contiguous(week_list):
            """Check if weeks form a contiguous block."""
            if len(week_list) <= 1:
                return True

            # Parse week numbers
            week_nums = []
            for w in sorted(week_list):
                try:
                    week_num = int(w.split('-W')[1])
                    year = int(w.split('-W')[0])
                    # Create comparable number (year * 100 + week)
                    week_nums.append(year * 100 + week_num)
                except:
                    continue

            if not week_nums:
                return False

            week_nums = sorted(week_nums)
            # Check if consecutive (allowing for year boundaries)
            gaps = []
            for i in range(len(week_nums) - 1):
                diff = week_nums[i+1] - week_nums[i]
                # Handle year boundary (e.g., 2025W52 → 2026W01)
                if diff == 49 or diff == 50:  # Year boundary
                    gaps.append(1)
                elif diff <= 2:  # Allow small gaps for week number irregularities
                    gaps.append(diff)
                else:
                    gaps.append(diff)

            # Contiguous if most gaps are 1
            if not gaps:
                return True
            avg_gap = sum(gaps) / len(gaps)
            return avg_gap <= 1.5

        # Calculate contiguity for top clusters
        cluster_contiguity = [is_contiguous(weeks_list) for sig, weeks_list in clusters[:3]]

        # Build analysis record
        record = {
            'route_id': route_id,
            'route_name': route_name,
            'total_weeks': total_weeks,
            'num_clusters': num_clusters,
            'largest_cluster_size': largest_cluster_size,
            'largest_cluster_pct': largest_cluster_pct,
            'clusters': clusters,
        }

        # Add second cluster info if exists
        if num_clusters >= 2:
            second_cluster_size = len(clusters[1][1])
            record['second_cluster_size'] = second_cluster_size
            record['second_cluster_pct'] = (second_cluster_size / total_weeks) * 100
            record['top2_coverage'] = (largest_cluster_size + second_cluster_size) / total_weeks * 100
        else:
            record['second_cluster_size'] = 0
            record['second_cluster_pct'] = 0
            record['top2_coverage'] = largest_cluster_pct

        # Categorize
        if num_clusters == 1:
            results['fully_stable'].append(record)

        elif num_clusters == 2 and cluster_contiguity[0] and cluster_contiguity[1]:
            # Two contiguous blocks = likely timetable changeover
            results['timetable_changeover'].append(record)

        elif largest_cluster_pct >= 85 and num_clusters <= 5:
            # Large stable period with a few exceptions
            results['holiday_exceptions'].append(record)

        elif num_clusters <= 5 and record['top2_coverage'] >= 75:
            # A few stable periods covering most weeks
            results['multiple_stable_periods'].append(record)

        else:
            # Too fragmented
            results['chaotic'].append(record)

    # Print results
    total_routes = sum(len(results[k]) for k in results.keys())

    print(f"\n{'─'*70}")
    print("STABILITY CLASSIFICATION")
    print(f"{'─'*70}")
    print(f"Total routes analyzed: {total_routes}")

    print(f"\n✓ FULLY PUBLISHABLE:")
    print(f"  Fully stable (1 pattern):           {len(results['fully_stable']):3d} ({len(results['fully_stable'])/total_routes*100:5.1f}%)")
    print(f"  Timetable changeover (2 periods):   {len(results['timetable_changeover']):3d} ({len(results['timetable_changeover'])/total_routes*100:5.1f}%)")
    print(f"  Holiday exceptions only:            {len(results['holiday_exceptions']):3d} ({len(results['holiday_exceptions'])/total_routes*100:5.1f}%)")

    print(f"\n→ POSSIBLY PUBLISHABLE:")
    print(f"  Multiple stable periods:            {len(results['multiple_stable_periods']):3d} ({len(results['multiple_stable_periods'])/total_routes*100:5.1f}%)")

    print(f"\n⚠️  NOT PUBLISHABLE:")
    print(f"  Chaotic variation:                  {len(results['chaotic']):3d} ({len(results['chaotic'])/total_routes*100:5.1f}%)")

    publishable = len(results['fully_stable']) + len(results['timetable_changeover']) + len(results['holiday_exceptions'])
    print(f"\n{'─'*70}")
    print(f"SUMMARY: {publishable} / {total_routes} ({publishable/total_routes*100:.1f}%) are publishable")

    # Show examples
    print(f"\n{'─'*70}")
    print("EXAMPLES")
    print(f"{'─'*70}")

    if results['timetable_changeover']:
        print(f"\nTimetable Changeover (publish 2 versions):")
        for r in results['timetable_changeover'][:5]:
            clusters = r['clusters']
            weeks1 = sorted(clusters[0][1])
            weeks2 = sorted(clusters[1][1])
            print(f"  {r['route_name']:25s} {r['total_weeks']} weeks:")
            print(f"    Period 1: {weeks1[0]} to {weeks1[-1]} ({len(weeks1)} weeks)")
            print(f"    Period 2: {weeks2[0]} to {weeks2[-1]} ({len(weeks2)} weeks)")

    if results['holiday_exceptions']:
        print(f"\nHoliday Exceptions (publish with disclaimers):")
        for r in sorted(results['holiday_exceptions'], key=lambda x: x['largest_cluster_pct'], reverse=True)[:5]:
            clusters = r['clusters']
            typical_weeks = sorted(clusters[0][1])
            exceptional_weeks = []
            for sig, weeks_list in clusters[1:]:
                exceptional_weeks.extend(weeks_list)
            exceptional_weeks = sorted(exceptional_weeks)

            print(f"  {r['route_name']:25s} {r['total_weeks']} weeks: {r['largest_cluster_size']} typical ({r['largest_cluster_pct']:.0f}%)")
            if len(exceptional_weeks) <= 5:
                print(f"    Exceptions: {', '.join(exceptional_weeks)}")

    if results['chaotic']:
        print(f"\nChaotic (not publishable):")
        for r in sorted(results['chaotic'], key=lambda x: x['num_clusters'])[:5]:
            print(f"  {r['route_name']:25s} {r['total_weeks']} weeks split into {r['num_clusters']} patterns")
            print(f"    Largest: {r['largest_cluster_size']} weeks ({r['largest_cluster_pct']:.0f}%)")

    # Exceptional week analysis
    print(f"\n{'─'*70}")
    print("EXCEPTIONAL WEEKS ACROSS ALL ROUTES")
    print(f"{'─'*70}")

    all_exceptional_weeks = Counter()
    for category in ['holiday_exceptions', 'multiple_stable_periods']:
        for r in results[category]:
            # Weeks not in largest cluster are exceptional
            largest_cluster_weeks = set(r['clusters'][0][1])
            all_weeks = set()
            for sig, weeks_list in r['clusters']:
                all_weeks.update(weeks_list)
            exceptional = all_weeks - largest_cluster_weeks
            for week in exceptional:
                all_exceptional_weeks[week] += 1

    if all_exceptional_weeks:
        print(f"\nMost common exceptional weeks:")
        for week, count in all_exceptional_weeks.most_common(15):
            print(f"  {week}: {count:3d} routes")

    return results

def main():
    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    print("Reading Rail GTFS data...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    results = analyze_rigorous_stability(rail_feed)

    print(f"\n{'='*70}")
    print("PUBLICATION STRATEGY")
    print(f"{'='*70}")

    total = sum(len(results[k]) for k in results.keys())
    fully_pub = len(results['fully_stable']) + len(results['timetable_changeover']) + len(results['holiday_exceptions'])

    print(f"\n1. Fully Stable ({len(results['fully_stable'])} routes):")
    print(f"   → Publish single analysis, valid all year")

    print(f"\n2. Timetable Changeover ({len(results['timetable_changeover'])} routes):")
    print(f"   → Publish TWO versions with date ranges")
    print(f"   → Example: 'Valid Dec 2025 - May 2026' and 'Valid May 2026+'")

    print(f"\n3. Holiday Exceptions ({len(results['holiday_exceptions'])} routes):")
    print(f"   → Publish typical week with disclaimer")
    print(f"   → 'Valid except weeks: 2025-W50, 2025-W51, 2025-W52, 2026-W01'")

    print(f"\n4. Multiple Stable Periods ({len(results['multiple_stable_periods'])} routes):")
    print(f"   → Review individually - may need 2-3 versions")

    print(f"\n5. Chaotic ({len(results['chaotic'])} routes):")
    print(f"   → NOT PUBLISHABLE as static analysis")
    print(f"   → Would need date-specific queries")

    print(f"\n{'─'*70}")
    print(f"BOTTOM LINE: {fully_pub}/{total} ({fully_pub/total*100:.1f}%) routes can be published")
    print(f"  with appropriate versioning/disclaimers")

if __name__ == "__main__":
    main()
