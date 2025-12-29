#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/analyzer"

echo "Building analyzer..."
echo
mvn clean package -Dmaven.test.skip -q

echo
echo "Running analyser..."
echo
java -jar target/munro-access-analyzer-0.1.jar ../starts.json ../targets.json ../results.jsonl
