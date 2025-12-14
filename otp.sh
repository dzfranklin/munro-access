#!/usr/bin/env bash
set -euo pipefail

OTP_VERSION="2.8.1"
OTP="otp/otp-shaded-$OTP_VERSION.jar"

BUILD=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      BUILD=true
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

if [ "$BUILD" = true ]; then
  java -Xmx8G -jar "$OTP" --build --save ./otp
  exit 0
fi

exec java -Xmx2G -jar "$OTP" --load ./otp
