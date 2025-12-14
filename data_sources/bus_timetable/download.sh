#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

# Validate required environment variable
if [ -z "$BODS_API_KEY" ]; then
  echo "Error: BODS_API_KEY not found in .env file"
  echo "Please add BODS_API_KEY to .env"
  echo "Get your API key from: https://data.bus-data.dft.gov.uk/account/settings/"
  exit 1
fi

# Download GTFS data
OUTPUT_FILE="out/bus_scot_gtfs.zip"
DOWNLOAD_URL="https://data.bus-data.dft.gov.uk/timetable/download/gtfs-file/scotland/?api_key=${BODS_API_KEY}"

mkdir -p out
echo "Downloading Scotland GTFS data from BODS..."
if curl -L -o "$OUTPUT_FILE" "$DOWNLOAD_URL"; then
  # Verify file exists and is not empty
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    echo "Success! Created $OUTPUT_FILE"
    ls -lh "$OUTPUT_FILE"
  else
    echo "Error: Download succeeded but file is empty or missing"
    exit 1
  fi
else
  echo "Error: Download failed"
  exit 1
fi
