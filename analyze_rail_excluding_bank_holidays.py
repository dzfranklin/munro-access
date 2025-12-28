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
Analyze rail schedule stability excluding bank holiday weeks.
If remaining weeks are stable, the schedule is publishable with
"Valid except bank holidays" disclaimer.
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
    print(f"Fetching Scotland bank holidays from {SCOTLAND_BANK_HOLIDAYS_URL}...")

    try:
        response = requests.get(SCOTLAND_BANK_HOLIDAYS_URL, timeout=10)
        response.raise_for_status()

        cal = Calendar.from_ical(response.content)

        bank_holidays = []
        for component in cal.walk():
            if component.name == "VEVENT":
                dt = component.get('dtstart').dt
                summary = str(component.get('summary'))
                bank_holidays.append({
                    'date': dt,
                    'name': summary
                })

        print(f"Found {len(bank_holidays)} bank holidays")
        return bank_holidays

    except Exception as e:
        print(f"ERROR fetching bank holidays: {e}", file=sys.stderr)
        sys.exit(1)

def get_week_key(date):
    """Convert date to week key."""
    iso = date.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"

def analyze_rail_excluding_holidays(feed, bank_holidays, additional_exclusions=None):
    """Analyze rail stability excluding bank holiday weeks."""
    print(f"\n{'='*70}")
    print(f"  Rail Analysis (Excluding Bank Holiday Weeks)")
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
    print(f"\nGTFS data range: {min_date} to {max_date}")

    # Identify bank holiday weeks
    bank_holiday_weeks = set()
    print(f"\nBank holidays in GTFS period:")
    for bh in sorted(bank_holidays, key=lambda x: x['date']):
        if isinstance(bh['date'], datetime):
            bh_date = bh['date'].date()
        else:
            bh_date = bh['date']

        week_key = get_week_key(bh_date)
        bank_holiday_weeks.add(week_key)
        print(f"  {bh_date} ({week_key}): {bh['name']}")

    # Add additional exceptional weeks if provided
    if additional_exclusions:
        bank_holiday_weeks.update(additional_exclusions)
        print(f"\nAdditional weeks to exclude: {len(additional_exclusions)}")
        print(f"  {', '.join(sorted(additional_exclusions))}")

    print(f"\nTotal weeks to exclude: {len(bank_holiday_weeks)}")
    print(f"  {', '.join(sorted(bank_holiday_weeks))}")

    # Build week-by-week patterns
    trips_with_cal = trips.merge(calendar, on='service_id', how='left')
    trip_departure_counts = stop_times.groupby('trip_id').size().to_dict()

    route_weekly_data = defaultdict(lambda: {
        'route_name': None,
        'weeks': defaultdict(lambda: {
            'service_ids': set(),
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
                week_key = get_week_key(current_date)

                # Skip bank holiday weeks
                if week_key in bank_holiday_weeks:
                    current_date += timedelta(days=7 - current_date.weekday())
                    continue

                route_weekly_data[route_id]['weeks'][week_key]['service_ids'].add(service_id)
                route_weekly_data[route_id]['weeks'][week_key]['weekday_pattern'] = weekday_pattern
                route_weekly_data[route_id]['weeks'][week_key]['total_departures'] += departure_count

                current_date += timedelta(days=7 - current_date.weekday())
        except (ValueError, KeyError):
            continue

    # Analyze stability after excluding bank holidays
    print(f"\nAnalyzing stability (excluding bank holiday weeks)...")

    results = {
        'fully_stable': [],           # All non-holiday weeks identical
        'mostly_stable': [],          # 90%+ weeks identical
        'some_variation': [],         # 70-90% weeks identical
        'high_variation': [],         # <70% weeks identical
    }

    for route_id, data in route_weekly_data.items():
        weeks = data['weeks']
        route_name = data['route_name']

        if len(weeks) < 4:  # Ignore routes with less than 4 weeks
            continue

        # Create exact signature for each week
        week_signatures = {}
        for week_key, week_data in weeks.items():
            # Use frozenset of service IDs as signature
            sig = (week_data['weekday_pattern'], frozenset(week_data['service_ids']))
            week_signatures[week_key] = sig

        # Count signature occurrences
        signature_counts = Counter(week_signatures.values())

        # Find most common (typical) pattern
        most_common_sig, most_common_count = signature_counts.most_common(1)[0]
        total_weeks = len(weeks)
        typical_pct = (most_common_count / total_weeks) * 100

        # Get weeks with typical and exceptional patterns
        typical_weeks = sorted([w for w, sig in week_signatures.items() if sig == most_common_sig])
        exceptional_weeks = sorted([w for w, sig in week_signatures.items() if sig != most_common_sig])

        num_exceptional_patterns = len(signature_counts) - 1

        record = {
            'route_id': route_id,
            'route_name': route_name,
            'total_weeks': total_weeks,
            'typical_weeks': most_common_count,
            'typical_pct': typical_pct,
            'exceptional_weeks': len(exceptional_weeks),
            'num_patterns': len(signature_counts),
            'exceptional_week_list': exceptional_weeks,
        }

        # Categorize
        if typical_pct == 100:
            results['fully_stable'].append(record)
        elif typical_pct >= 90:
            results['mostly_stable'].append(record)
        elif typical_pct >= 70:
            results['some_variation'].append(record)
        else:
            results['high_variation'].append(record)

    # Print results
    total_routes = sum(len(results[k]) for k in results.keys())

    print(f"\n{'─'*70}")
    print("STABILITY RESULTS (AFTER EXCLUDING BANK HOLIDAYS)")
    print(f"{'─'*70}")
    print(f"Total routes analyzed: {total_routes}")

    fully_stable = len(results['fully_stable'])
    mostly_stable = len(results['mostly_stable'])
    some_variation = len(results['some_variation'])
    high_variation = len(results['high_variation'])

    print(f"\n  Fully stable (100%):      {fully_stable:3d} ({fully_stable/total_routes*100:5.1f}%)")
    print(f"  Mostly stable (≥90%):     {mostly_stable:3d} ({mostly_stable/total_routes*100:5.1f}%)")
    print(f"  Some variation (70-90%):  {some_variation:3d} ({some_variation/total_routes*100:5.1f}%)")
    print(f"  High variation (<70%):    {high_variation:3d} ({high_variation/total_routes*100:5.1f}%)")

    publishable = fully_stable + mostly_stable
    print(f"\n{'─'*70}")
    print(f"✓ PUBLISHABLE: {publishable} / {total_routes} ({publishable/total_routes*100:.1f}%)")
    print(f"  Strategy: 'Valid for non-bank-holiday weeks'")
    print(f"⚠️  NEEDS REVIEW: {some_variation + high_variation} ({(some_variation + high_variation)/total_routes*100:.1f}%)")

    # Show examples
    print(f"\n{'─'*70}")
    print("EXAMPLES")
    print(f"{'─'*70}")

    if results['mostly_stable']:
        print(f"\nMostly Stable (≥90%):")
        for r in sorted(results['mostly_stable'], key=lambda x: x['total_weeks'], reverse=True)[:10]:
            print(f"  {r['route_name']:25s} {r['total_weeks']:2d} weeks: {r['typical_weeks']:2d} typical ({r['typical_pct']:.0f}%), {r['exceptional_weeks']} exceptions")
            if r['exceptional_weeks'] <= 3:
                print(f"    Exception weeks: {', '.join(r['exceptional_week_list'])}")

    if results['some_variation']:
        print(f"\nSome Variation (70-90%):")
        for r in sorted(results['some_variation'], key=lambda x: x['typical_pct'], reverse=True)[:5]:
            print(f"  {r['route_name']:25s} {r['total_weeks']:2d} weeks: {r['typical_weeks']:2d} typical ({r['typical_pct']:.0f}%), {r['num_patterns']} patterns")

    if results['high_variation']:
        print(f"\nHigh Variation (<70%):")
        for r in sorted(results['high_variation'], key=lambda x: x['typical_pct'], reverse=True)[:5]:
            print(f"  {r['route_name']:25s} {r['total_weeks']:2d} weeks: {r['typical_weeks']:2d} typical ({r['typical_pct']:.0f}%), {r['num_patterns']} patterns")

    # Remaining exceptional weeks (not bank holidays)
    if results['mostly_stable'] or results['some_variation']:
        print(f"\n{'─'*70}")
        print("REMAINING EXCEPTIONAL WEEKS (NOT BANK HOLIDAYS)")
        print(f"{'─'*70}")

        all_exceptional = Counter()
        for category in ['mostly_stable', 'some_variation']:
            for r in results[category]:
                for week in r['exceptional_week_list']:
                    all_exceptional[week] += 1

        if all_exceptional:
            print(f"\nMost common non-bank-holiday exceptions:")
            for week, count in all_exceptional.most_common(10):
                print(f"  {week}: {count:3d} routes")
            print(f"\nThese may be: school holidays, timetable changeover dates, etc.")

    return results

def main():
    if not RAIL_GTFS.exists():
        print(f"ERROR: Rail GTFS not found: {RAIL_GTFS}", file=sys.stderr)
        sys.exit(1)

    # Fetch bank holidays
    bank_holidays = fetch_scotland_bank_holidays()

    # Load GTFS
    print(f"\nReading Rail GTFS data...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    # First pass: identify common exceptional weeks
    print(f"\n{'='*70}")
    print("PASS 1: Identifying exceptional weeks")
    print(f"{'='*70}")

    results_pass1 = analyze_rail_excluding_holidays(rail_feed, bank_holidays)

    # Identify weeks that affect many routes
    all_exceptional_pass1 = Counter()
    for category in ['mostly_stable', 'some_variation']:
        for r in results_pass1[category]:
            for week in r['exceptional_week_list']:
                all_exceptional_pass1[week] += 1

    # Exclude weeks that affect 10+ routes (likely school holidays/timetable changes)
    common_exceptional_weeks = set([week for week, count in all_exceptional_pass1.items() if count >= 10])

    if common_exceptional_weeks:
        print(f"\n{'='*70}")
        print("PASS 2: Re-analyzing with additional exclusions")
        print(f"{'='*70}")
        print(f"\nExcluding {len(common_exceptional_weeks)} additional weeks affecting 10+ routes:")
        for week in sorted(common_exceptional_weeks):
            count = all_exceptional_pass1[week]
            print(f"  {week}: {count} routes")

        results = analyze_rail_excluding_holidays(rail_feed, bank_holidays, common_exceptional_weeks)
    else:
        print(f"\nNo additional common exceptional weeks found.")
        results = results_pass1

    print(f"\n{'='*70}")
    print("PUBLICATION RECOMMENDATION")
    print(f"{'='*70}")

    total = sum(len(results[k]) for k in results.keys())
    publishable = len(results['fully_stable']) + len(results['mostly_stable'])

    if publishable / total >= 0.8:
        print(f"\n✓ EXCELLENT: {publishable/total*100:.1f}% publishable")
        print(f"  → Publish with disclaimer: 'Valid for typical weeks'")
        print(f"  → Exclude: Bank holidays + any remaining exceptional weeks")
    elif publishable / total >= 0.6:
        print(f"\n→ GOOD: {publishable/total*100:.1f}% publishable")
        print(f"  → Can publish for most routes")
    else:
        print(f"\n⚠️  Only {publishable/total*100:.1f}% publishable")
        print(f"  → May need more sophisticated approach")

if __name__ == "__main__":
    main()
