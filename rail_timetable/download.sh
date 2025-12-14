#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

# Parse arguments
PREVIEW_MODE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --preview)
      PREVIEW_MODE="--preview"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--preview]"
      exit 1
      ;;
  esac
done

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "Loading credentials from .env file..."
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found"
  echo "Please create a .env file with NRDP_username and NRDP_password"
  exit 1
fi

# Validate required environment variables
if [ -z "$NRDP_username" ] || [ -z "$NRDP_password" ]; then
  echo "Error: NRDP credentials not found in .env file"
  echo "Please ensure .env contains NRDP_username and NRDP_password"
  exit 1
fi

echo "Using NRDP username: $NRDP_username"

# Run the conversion
echo "Running GTFS conversion..."
if [ -n "$PREVIEW_MODE" ]; then
  echo "Preview mode enabled"
  Rscript entrypoint.R --preview
else
  Rscript entrypoint.R
fi

# Check if output was created
OUTPUT_NAME=out/rail_scot_gtfs.zip
if [ -f "$OUTPUT_NAME" ]; then
  echo "Success! Created $OUTPUT_NAME"
  ls -lh "$OUTPUT_NAME"
else
  echo "Error: Output file not found at $OUTPUT_NAME"
  exit 1
fi
