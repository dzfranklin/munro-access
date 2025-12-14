#!/bin/bash
set -e

# Change to script directory
cd "$(dirname "$0")"

# Configuration
IMAGE_NAME="rail-gtfs-converter"
OUTPUT_DIR=$(mktemp -d)
PREVIEW_MODE=""

# Cleanup on exit
cleanup() {
  if [ -d "$OUTPUT_DIR" ]; then
    echo "Cleaning up temporary directory..."
    rm -rf "$OUTPUT_DIR"
  fi
}
trap cleanup EXIT

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
echo "Using temporary directory: $OUTPUT_DIR"

# Build the Docker image
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

# Run the conversion
echo "Running GTFS conversion..."
if [ -n "$PREVIEW_MODE" ]; then
  echo "Preview mode enabled"
fi

docker run --rm \
  -e NRDP_username="$NRDP_username" \
  -e NRDP_password="$NRDP_password" \
  -v "$OUTPUT_DIR:/app/out" \
  "$IMAGE_NAME" \
  $PREVIEW_MODE

# Check if output was created and copy it
OUTPUT_NAME=rail_scot_gtfs.zip
OUTPUT_PATH="$OUTPUT_DIR/$OUTPUT_NAME"
if [ -f $OUTPUT_PATH ]; then
  cp $OUTPUT_PATH ./$OUTPUT_NAME
  echo "Success! Created $OUTPUT_NAME"
  ls -lh ./$OUTPUT_NAME
else
  echo "Error: Output file not found at $OUTPUT_PATH"
  exit 1
fi
