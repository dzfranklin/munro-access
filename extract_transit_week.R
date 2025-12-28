#!/usr/bin/env Rscript

# Define package dependencies
renv::use(
  verbose = FALSE,
  "dzfranklin/UK2GTFS@route-short-name"
)

# Load required library
library(UK2GTFS)

# Helper function for error handling
safe_execute <- function(expr, error_msg) {
  tryCatch(
    expr,
    error = function(e) {
      message(sprintf("ERROR: %s\n", error_msg))
      message(sprintf("Details: %s\n", e$message))
      quit(status = 1)
    }
  )
}

# Configuration
bus_gtfs_file <- "otp/bus_scot_gtfs.zip"
rail_gtfs_file <- "otp/rail_scot_gtfs.zip"
output_file <- "otp/transit_week.txt"

# Check files exist
if (!file.exists(bus_gtfs_file)) {
  stop(sprintf("Bus GTFS file not found: %s\nHave you run ./download_timetables.sh?", bus_gtfs_file))
}

if (!file.exists(rail_gtfs_file)) {
  stop(sprintf("Rail GTFS file not found: %s\nHave you run ./download_timetables.sh?", rail_gtfs_file))
}

# Read both GTFS files
message("Reading bus GTFS...")
bus_gtfs <- safe_execute(
  gtfs_read(bus_gtfs_file),
  "Failed to read bus GTFS"
)

message("Reading rail GTFS...")
rail_gtfs <- safe_execute(
  gtfs_read(rail_gtfs_file),
  "Failed to read rail GTFS"
)

# Extract start dates from calendar tables
bus_start <- NA
rail_start <- NA

if (!is.null(bus_gtfs$calendar) && nrow(bus_gtfs$calendar) > 0) {
  bus_start <- min(bus_gtfs$calendar$start_date, na.rm = TRUE)
  message(sprintf("Bus calendar start: %d\n", bus_start))
} else if (!is.null(bus_gtfs$calendar_dates) && nrow(bus_gtfs$calendar_dates) > 0) {
  bus_start <- min(bus_gtfs$calendar_dates$date, na.rm = TRUE)
  message(sprintf("Bus calendar_dates start: %d\n", bus_start))
} else {
  stop("Bus GTFS has no calendar or calendar_dates data")
}

if (!is.null(rail_gtfs$calendar) && nrow(rail_gtfs$calendar) > 0) {
  rail_start <- min(rail_gtfs$calendar$start_date, na.rm = TRUE)
  message(sprintf("Rail calendar start: %d\n", rail_start))
} else if (!is.null(rail_gtfs$calendar_dates) && nrow(rail_gtfs$calendar_dates) > 0) {
  rail_start <- min(rail_gtfs$calendar_dates$date, na.rm = TRUE)
  message(sprintf("Rail calendar_dates start: %d\n", rail_start))
} else {
  stop("Rail GTFS has no calendar or calendar_dates data")
}

# Validate both have same week start
if (is.na(bus_start) || is.na(rail_start)) {
  stop("Failed to extract start dates from GTFS files")
}

if (bus_start != rail_start) {
  bus_date_str <- format(as.Date(as.character(bus_start), "%Y%m%d"), "%Y-%m-%d (%A)")
  rail_date_str <- format(as.Date(as.character(rail_start), "%Y%m%d"), "%Y-%m-%d (%A)")
  stop(sprintf("GTFS week mismatch!\n  Bus starts:  %s\n  Rail starts: %s\n\nBoth must be trimmed to the same week.", bus_date_str, rail_date_str))
}

message("✓ Both GTFS files have matching week start\n")

# Convert to YYYY-MM-DD format for Java
start_date_formatted <- format(as.Date(as.character(bus_start), "%Y%m%d"), "%Y-%m-%d")

# Write to output file
message(sprintf("Writing transit week start to %s...\n", output_file))
dir.create(dirname(output_file), recursive = TRUE, showWarnings = FALSE)
writeLines(start_date_formatted, output_file)

message(sprintf("=== TRANSIT WEEK EXTRACTED: %s ===\n", start_date_formatted))
quit(status = 0)
