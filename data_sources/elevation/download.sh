#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Configuration
SCOTTISH_GRIDS="hp ht hu hw hx hy hz na nb nc nd nf ng nh nj nk nl nm nn no nr ns nt nu nw nx ny nz"
OUT_DIR="out"
EXTRACT_DIR="$OUT_DIR/extracted_asc"
TEMP_GEOTIFF="$OUT_DIR/scotland_terrain50_wgs84.tif"
FINAL_OUTPUT="$OUT_DIR/scot_dem.tif"

echo "=== OS Terrain50 Processing for Scotland ==="

mkdir -p out

curl -L -o out/terr50_gagg_gb.zip "https://api.os.uk/downloads/v1/products/Terrain50/downloads?area=GB&format=ASCII+Grid+and+GML+%28Grid%29&redirect"

# Unzip source data
echo "Unzipping source data..."
rm -rf out/terr50_gagg_gb && unzip -q out/terr50_gagg_gb.zip -d out/terr50_gagg_gb

if [ ! -d "$OUT_DIR/terr50_gagg_gb/data" ]; then
  echo "Error: Source data not found at $OUT_DIR/terr50_gagg_gb/data"
  exit 1
fi

# Step 1: Extract ASC files from Scottish grid squares
echo "Extracting ASC files from Scottish grid squares..."
mkdir -p "$EXTRACT_DIR"
rm -f "$EXTRACT_DIR"/*.asc  # Clean any previous extracts

extracted_count=0
for grid in $SCOTTISH_GRIDS; do
  grid_dir="$OUT_DIR/terr50_gagg_gb/data/$grid"
  if [ -d "$grid_dir" ]; then
    echo "  Processing grid: $grid"
    for zipfile in "$grid_dir"/*.zip; do
      if [ -f "$zipfile" ]; then
        unzip -j -o -qq "$zipfile" "*.asc" -d "$EXTRACT_DIR/" 2>/dev/null || true
        extracted_count=$((extracted_count + 1))
      fi
    done
  fi
done

# Verify extraction
asc_count=$(find "$EXTRACT_DIR" -name "*.asc" 2>/dev/null | wc -l | tr -d ' ')
echo "Extracted $asc_count ASC files from $extracted_count ZIP files"

if [ "$asc_count" -lt 100 ]; then
  echo "Error: Expected ~1,200+ ASC files but found only $asc_count"
  exit 1
fi

# Step 2 & 3: Merge, reproject to WGS84 and create compressed GeoTIFF
# Note: Using gdalwarp directly instead of VRT to handle mixed data types (Float32/Int32)
echo "Converting to WGS84 GeoTIFF with LZW compression..."

gdalwarp \
  -s_srs EPSG:27700 \
  -t_srs EPSG:4326 \
  -r bilinear \
  -co TILED=YES \
  -co COMPRESS=LZW \
  -co PREDICTOR=2 \
  -co BLOCKXSIZE=256 \
  -co BLOCKYSIZE=256 \
  -co NUM_THREADS=ALL_CPUS \
  -co BIGTIFF=IF_SAFER \
  -overwrite \
  "$EXTRACT_DIR"/*.asc \
  "$TEMP_GEOTIFF"

if [ ! -f "$TEMP_GEOTIFF" ] || [ ! -s "$TEMP_GEOTIFF" ]; then
  echo "Error: GeoTIFF conversion failed"
  exit 1
fi

echo "GeoTIFF created successfully"

# Step 4: Add overviews for better performance
echo "Adding overview pyramids..."
gdaladdo \
  -r average \
  --config COMPRESS_OVERVIEW LZW \
  --config PREDICTOR_OVERVIEW 2 \
  "$TEMP_GEOTIFF" \
  2 4 8 16 32 64

# Step 5: Rename to final output (calling script will move to otp/)
echo "Finalizing output..."
mv "$TEMP_GEOTIFF" "$FINAL_OUTPUT"

if [ -f "$FINAL_OUTPUT" ] && [ -s "$FINAL_OUTPUT" ]; then
  echo "Success! Elevation data ready at $FINAL_OUTPUT"
  ls -lh "$FINAL_OUTPUT"
  echo ""
  echo "File info:"
  gdalinfo "$FINAL_OUTPUT" | grep -E "Size is|Pixel Size|Corner Coordinates|Upper Left|Lower Right|COMPRESS="
else
  echo "Error: Failed to create final output"
  exit 1
fi

# Step 6: Cleanup temporary files
echo "Cleaning up temporary files..."
rm -rf "$EXTRACT_DIR"
rm -rf "$OUT_DIR/terr50_gagg_gb"
rm -f "$OUT_DIR/terr50_gagg_gb.zip"

echo "Processing complete!"
