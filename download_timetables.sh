#!/usr/bin/env bash
set -eo pipefail

BUS_GTFS="otp/bus_scot_gtfs.zip"
RAIL_GTFS="otp/rail_scot_gtfs.zip"

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "Loading credentials from .env file..."
  set -a
  source .env
  set +a
else
  echo "WARNING: .env file not found. See .env.example for expected environment variables"
fi

echo
echo "Downloading bus timetable..."
./data_sources/bus_timetable/download.sh
mv data_sources/bus_timetable/out/bus_scot_gtfs.zip "$BUS_GTFS"

echo
echo "Downloading rail timetable..."
./data_sources/rail_timetable/download.sh
mv data_sources/rail_timetable/out/rail_scot_gtfs.zip "$RAIL_GTFS"
