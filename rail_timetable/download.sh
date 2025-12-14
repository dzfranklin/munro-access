#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

# Configuration
IMAGE_NAME="rail-gtfs-converter"
OUTPUT_DIR="./output"
PREVIEW_MODE=""

# Parse arguments
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

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Run the conversion
echo "Running GTFS conversion..."
if [ -n "$PREVIEW_MODE" ]; then
  echo "Preview mode enabled"
  docker run --rm -v "$(pwd)/$OUTPUT_DIR:/app/out" "$IMAGE_NAME" Rscript entrypoint.R --preview
else
  docker run --rm -v "$(pwd)/$OUTPUT_DIR:/app/out" "$IMAGE_NAME"
fi

# Check if output was created
if [ -f "$OUTPUT_DIR/rail_scot_gtfs.zip" ]; then
  echo "Success! Output created at: $OUTPUT_DIR/rail_scot_gtfs.zip"
  ls -lh "$OUTPUT_DIR/rail_scot_gtfs.zip"
else
  echo "Error: Output file not found at $OUTPUT_DIR/rail_scot_gtfs.zip"
  exit 1
fi
