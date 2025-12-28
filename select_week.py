#!/usr/bin/env python3
"""
Select a suitable week for GTFS trimming, avoiding blacklisted periods.
Outputs the Monday start date in YYYYMMDD format.
"""

from datetime import datetime, timedelta

# Blacklist configuration: (month, day) tuples for periods to avoid
# Each entry is a range: (start_month, start_day, end_month, end_day)
BLACKLIST_PERIODS = [
    # Winter holidays: December and January
    (12, 1, 1, 31),  # Dec 1 - Jan 31
]


def is_week_blacklisted(week_start: datetime.date) -> bool:
    """Check if the given week falls within any blacklisted period."""
    week_end = week_start + timedelta(days=6)

    for start_month, start_day, end_month, end_day in BLACKLIST_PERIODS:
        # Check if any part of the week overlaps with this blacklist period
        # Check current year, previous year, and next year to handle boundaries
        for year in [week_start.year - 1, week_start.year, week_start.year + 1]:
            blacklist_start = datetime(year, start_month, start_day).date()
            # Handle case where end is in the next year
            if end_month < start_month:
                blacklist_end = datetime(year + 1, end_month, end_day).date()
            else:
                blacklist_end = datetime(year, end_month, end_day).date()

            # Check if week overlaps with blacklist period
            if not (week_end < blacklist_start or week_start > blacklist_end):
                return True

    return False


def get_next_monday() -> datetime.date:
    """Calculate the next Monday from today (or today if today is Monday)."""
    today = datetime.now().date()
    days_until_monday = (7 - today.weekday()) % 7
    return today + timedelta(days=days_until_monday)


def select_week() -> datetime.date:
    """
    Select the next suitable Monday, avoiding blacklisted periods.
    Returns the Monday date.
    """
    candidate = get_next_monday()
    max_attempts = 52  # Don't search more than a year ahead

    for _ in range(max_attempts):
        if not is_week_blacklisted(candidate):
            return candidate

        # Try next week
        candidate += timedelta(days=7)

    raise RuntimeError("Could not find a suitable week within the next year")


def main():
    """Output the selected Monday in YYYYMMDD format."""
    week_start = select_week()
    week_end = week_start + timedelta(days=6)

    # Output in YYYYMMDD format for GTFS
    print(week_start.strftime('%Y%m%d'))

    # Info to stderr
    print(f"# Selected week: {week_start} to {week_end}", file=__import__('sys').stderr)


if __name__ == "__main__":
    main()
