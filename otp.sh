#!/usr/bin/env bash
set -euo pipefail

OTP_VERSION="2.8.1"
OTP="otp/otp-shaded-$OTP_VERSION.jar"

BUILD=false
BUILD_STREET=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      BUILD=true
      shift
      ;;
    --buildStreet)
      BUILD_STREET=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ ! -f "$OTP" ]; then
  echo "Downloading OTP $OTP_VERSION..."
  curl -L -o "$OTP" "https://repo1.maven.org/maven2/org/opentripplanner/otp-shaded/$OTP_VERSION/otp-shaded-$OTP_VERSION.jar"
fi

mkdir -p otp/cache

if [[ "$BUILD_STREET" = true || ( "$BUILD" = true && ! -f otp/streetGraph.obj ) ]]; then
  java -Xmx8G -jar "$OTP" --buildStreet --save --cache ./otp/cache ./otp
  if [ "$BUILD" != true ]; then
    exit 0
  fi
fi

if [ "$BUILD" = true ]; then
  echo "Extracting transit week from GTFS..."
  uv run extract_transit_week.py

  java -Xmx8G -jar "$OTP" --loadStreet --save --cache ./otp/cache ./otp
  exit 0
fi

exec java -Xmx4G -jar "$OTP" --load ./otp
