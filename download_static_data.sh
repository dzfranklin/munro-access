#!/usr/bin/env bash
set -euo pipefail

echo "Downloading OSM data..."
curl -L -o otp/scotland.osm.pbf "https://download.geofabrik.de/europe/united-kingdom/scotland-latest.osm.pbf"

echo "Downloading elevation data..."
./data_sources/elevation/download.sh
mv ./data_sources/elevation/out/scot_dem.tif otp/
