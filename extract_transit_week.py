#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "gtfs-kit==12.0.0",
# ]
# ///
"""
Extract transit week start date from GTFS files and validate consistency.
Writes the week start date to otp/transit_week.txt for the analyzer.
"""

import sys
from pathlib import Path
import gtfs_kit as gk

# Configuration
BUS_GTFS = Path("otp/bus_scot_gtfs.zip")
RAIL_GTFS = Path("otp/rail_scot_gtfs.zip")
OUTPUT_FILE = Path("otp/transit_week.txt")

def get_gtfs_start_date(feed, name):
    """Extract the earliest start date from a GTFS feed."""
    start_date = None

    if feed.calendar is not None and not feed.calendar.empty:
        calendar_start = feed.calendar['start_date'].min()
        start_date = calendar_start
        print(f"{name} calendar start: {calendar_start}")

    if feed.calendar_dates is not None and not feed.calendar_dates.empty:
        calendar_dates_start = feed.calendar_dates['date'].min()
        if start_date is None or calendar_dates_start < start_date:
            start_date = calendar_dates_start
        print(f"{name} calendar_dates start: {calendar_dates_start}")

    if start_date is None:
        print(f"ERROR: {name} GTFS has no calendar or calendar_dates data", file=sys.stderr)
        sys.exit(1)

    return start_date

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

    # Read both GTFS files
    print("Reading bus GTFS...")
    bus_feed = gk.read_feed(str(BUS_GTFS), dist_units='km')

    print("Reading rail GTFS...")
    rail_feed = gk.read_feed(str(RAIL_GTFS), dist_units='km')

    # Extract start dates
    bus_start = get_gtfs_start_date(bus_feed, "Bus")
    rail_start = get_gtfs_start_date(rail_feed, "Rail")

    # Validate both have same week start
    if bus_start != rail_start:
        print("ERROR: GTFS week mismatch!", file=sys.stderr)
        print(f"  Bus starts:  {bus_start}", file=sys.stderr)
        print(f"  Rail starts: {rail_start}", file=sys.stderr)
        print("Both must be trimmed to the same week.", file=sys.stderr)
        sys.exit(1)

    print("✓ Both GTFS files have matching week start")

    # Convert YYYYMMDD to YYYY-MM-DD format for Java
    # Parse YYYYMMDD string to date
    year = int(bus_start[:4])
    month = int(bus_start[4:6])
    day = int(bus_start[6:8])
    formatted_date = f"{year:04d}-{month:02d}-{day:02d}"

    # Write to output file
    print(f"Writing transit week start to {OUTPUT_FILE}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(formatted_date)

    print(f"=== TRANSIT WEEK EXTRACTED: {formatted_date} ===")

if __name__ == "__main__":
    main()
