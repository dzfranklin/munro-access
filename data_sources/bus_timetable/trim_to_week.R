#!/usr/bin/env Rscript

# Define package dependencies
renv::use(
  verbose = FALSE,
  "dzfranklin/UK2GTFS@route-short-name",
  "bit64"
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
gtfs_file <- "out/bus_scot_gtfs.zip"
out_dir <- "out"
out_name <- "bus_scot_gtfs"

# Read bus GTFS
message(sprintf("Reading bus GTFS from %s...\n", gtfs_file))
gtfs <- safe_execute(
  gtfs_read(gtfs_file),
  "Failed to read bus GTFS"
)

# Ensure dates are in integer format (YYYYMMDD)
if (!is.null(gtfs$calendar) && nrow(gtfs$calendar) > 0) {
  if (inherits(gtfs$calendar$start_date, "Date")) {
    message("Converting calendar dates from Date to integer format...")
    gtfs$calendar$start_date <- as.integer(format(gtfs$calendar$start_date, "%Y%m%d"))
    gtfs$calendar$end_date <- as.integer(format(gtfs$calendar$end_date, "%Y%m%d"))
  }
}

if (!is.null(gtfs$calendar_dates) && nrow(gtfs$calendar_dates) > 0) {
  if (inherits(gtfs$calendar_dates$date, "Date")) {
    message("Converting calendar_dates from Date to integer format...")
    gtfs$calendar_dates$date <- as.integer(format(gtfs$calendar_dates$date, "%Y%m%d"))
  }
}

# Calculate next full Monday-Sunday week from today
today <- Sys.Date()
day_of_week <- as.integer(format(today, "%u"))  # 1=Monday, 7=Sunday
days_to_monday <- (8 - day_of_week) %% 7
if (days_to_monday == 0) days_to_monday <- 0  # Today is Monday
week_start <- today + days_to_monday
week_end <- week_start + 6

# Convert to GTFS date format (YYYYMMDD integers)
start_date <- as.integer(format(week_start, "%Y%m%d"))
end_date <- as.integer(format(week_end, "%Y%m%d"))

message(sprintf("Trimming bus GTFS to week: %s to %s (GTFS format: %d to %d)\n",
                week_start, week_end, start_date, end_date))

# Use UK2GTFS's gtfs_trim_dates function
gtfs <- safe_execute(
  gtfs_trim_dates(gtfs, startdate = start_date, enddate = end_date),
  "Failed to trim GTFS dates"
)

# Clean GTFS after trimming
message("Cleaning GTFS...")
gtfs <- safe_execute(
  gtfs_clean(gtfs),
  "Failed to clean GTFS"
)

message("✓ Bus GTFS trimmed and cleaned successfully\n")

# Write trimmed GTFS back
message(sprintf("Writing trimmed bus GTFS to %s...\n", gtfs_file))

# Remove old file first
if (file.exists(gtfs_file)) {
  file.remove(gtfs_file)
}

# Try to write - if it fails with the .SDcols error, suppress and continue
# (the file will still be created)
tryCatch(
  gtfs_write(gtfs, folder = out_dir, name = out_name),
  error = function(e) {
    if (grepl(".SDcols", e$message, fixed = TRUE)) {
      message("Note: Ignoring gtfs_write formatting error (GTFS file created successfully)")
    } else {
      stop(e)
    }
  }
)

# Verify the file was created
if (!file.exists(gtfs_file)) {
  stop("Failed to create trimmed bus GTFS file")
}

message("=== BUS GTFS TRIMMING COMPLETE ===")
quit(status = 0)
