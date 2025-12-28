#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
# ]
# ///
"""
Trim bus GTFS to Monday-Sunday week specified by GTFS_WEEK_START environment variable.
"""

import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
import gtfs_kit as gk

# Configuration
INPUT_FILE = Path("out/bus_scot_gtfs.zip")

def main():
    # Read week start from environment variable
    week_start_str = os.environ.get('GTFS_WEEK_START')
    if not week_start_str:
        print("ERROR: GTFS_WEEK_START environment variable not set", file=sys.stderr)
        print("This should be set by download_timetables.sh", file=sys.stderr)
        sys.exit(1)

    # Parse YYYYMMDD format
    week_start = datetime.strptime(week_start_str, '%Y%m%d').date()
    week_end = week_start + timedelta(days=6)

    print(f"Reading bus GTFS from {INPUT_FILE}...")
    feed = gk.read_feed(INPUT_FILE, dist_units='km')

    print(f"Trimming bus GTFS to week: {week_start} to {week_end}")

    # Filter by date range
    # gtfs-kit uses string dates in YYYYMMDD format
    start_str = week_start.strftime('%Y%m%d')
    end_str = week_end.strftime('%Y%m%d')

    # Filter calendar
    if feed.calendar is not None:
        feed.calendar = feed.calendar[
            (feed.calendar['end_date'] >= start_str) &
            (feed.calendar['start_date'] <= end_str)
        ].copy()

        # Trim to exact boundaries
        feed.calendar['start_date'] = feed.calendar['start_date'].apply(
            lambda x: max(x, start_str)
        )
        feed.calendar['end_date'] = feed.calendar['end_date'].apply(
            lambda x: min(x, end_str)
        )

    # Filter calendar_dates
    if feed.calendar_dates is not None:
        feed.calendar_dates = feed.calendar_dates[
            (feed.calendar_dates['date'] >= start_str) &
            (feed.calendar_dates['date'] <= end_str)
        ].copy()

    print("Cleaning GTFS (removing orphaned trips/routes/stops)...")
    # Clean up orphaned references
    feed = feed.clean()

    print(f"Writing trimmed bus GTFS to {INPUT_FILE}...")
    feed.to_file(INPUT_FILE)

    print("=== BUS GTFS TRIMMING COMPLETE ===")

if __name__ == "__main__":
    main()
