#!/usr/bin/env Rscript

# Define package dependencies
renv::use(
  verbose = FALSE,
  "sf",
  "rnaturalearth",
#   "ITSleeds/UK2GTFS@f15694a655c508f8caebaf99328b0a2d1bc8dfa5"
  "dzfranklin/UK2GTFS@route-short-name"
)

# Parse command-line arguments
args <- commandArgs(trailingOnly `= TRUE)
preview_mode <- "--preview" %in% args

# Configuration
out_dir <- "./out"
out_name <- "rail_scot_gtfs"
timetable_zip <- file.path(out_dir, "timetable.zip")
timetable_dir <- file.path(out_dir, "timetable")
scotland_rds <- file.path(out_dir, "scotland_boundary.rds")

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

# Load required libraries
message("Loading libraries...")
safe_execute(
  {
    library(UK2GTFS)
    library(sf)
    library(rnaturalearth)
    library(parallel)
  },
  "Failed to load required libraries"
)

# Create output directory
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

# Download Scotland boundary if not already cached
if (!file.exists(scotland_rds)) {
  message("Downloading Scotland boundary data from Natural Earth...")
  scotland_highres <- safe_execute(
    rnaturalearth::ne_download(
      scale = 10L,
      type = "map_subunits",
      category = "cultural",
      returnclass = "sf"
    ) |>
      subset(SU_A3 == "SCT"),
    "Failed to download Scotland boundary data"
  )

  # Buffer the boundary by 1000m
  message("Buffering Scotland boundary (1000m)...")
  scotland <- sf::st_buffer(scotland_highres, 1000)

  # Save Scotland boundary for later use
  message(sprintf("Saving Scotland boundary to %s\n", scotland_rds))
  saveRDS(scotland, scotland_rds)
} else {
  message(sprintf("Loading Scotland boundary from %s\n", scotland_rds))
  scotland <- readRDS(scotland_rds)
}

# Download timetable if not already present
if (dir.exists(timetable_dir) && length(list.files(timetable_dir)) > 0) {
  message(sprintf("Using existing timetable from %s\n", timetable_dir))
} else {
  # Get credentials from environment variables
  nrdp_username <- Sys.getenv("NRDP_username")
  nrdp_password <- Sys.getenv("NRDP_password")

  # Validate credentials are present
  if (nrdp_username == "" || nrdp_password == "") {
    message("ERROR: NRDP credentials not found in environment variables")
    message("Please set NRDP_username and NRDP_password")
    quit(status = 1)
  }

  message(sprintf("Downloading timetable from NRDP to %s...\n", timetable_zip))
  message(sprintf("Using NRDP username: %s\n", nrdp_username))

  safe_execute(
    nrdp_timetable(
      destfile = timetable_zip,
      username = nrdp_username,
      password = nrdp_password
    ),
    "Failed to download NRDP timetable"
  )

  message(sprintf("Unzipping timetable to %s...\n", timetable_dir))
  dir.create(timetable_dir, showWarnings = FALSE)
  safe_execute(
    unzip(timetable_zip, exdir = timetable_dir),
    "Failed to unzip timetable"
  )
}

# Detect number of cores
ncores <- parallel::detectCores()
message(sprintf("Using %d cores for processing\n", ncores))

# Convert ATOC to GTFS
message("Converting ATOC to GTFS...")
gtfs_raw <- safe_execute(
  atoc2gtfs(path_in = timetable_zip, ncores = ncores),
  "Failed to convert ATOC to GTFS"
)

# Clip to Scotland
message("Clipping to Scotland...")
gtfs <- safe_execute(
  gtfs_clip(gtfs_raw, scotland),
  "Failed to clip GTFS to Scotland"
)

# Add shapes
message("Creating shapes...")
gtfs <- safe_execute(
  ATOC_shapes(gtfs),
  "Failed to create shapes"
)

# Fix bug: ATOC_shapes incorrectly adds shape_id to stop_times
if ("shape_id" %in% names(gtfs$stop_times)) {
  message("Removing invalid shape_id column from stop_times...")
  gtfs$stop_times$shape_id <- NULL
}

# Validate before cleaning
message("Validating GTFS (before cleaning)...")
gtfs_validate_internal(gtfs)

# Clean GTFS
message("Cleaning GTFS...")
gtfs <- safe_execute(
  gtfs_clean(gtfs, public_only = TRUE),
  "Failed to clean GTFS"
)

# Clean transfers table
if (!is.null(gtfs$transfers)) {
  message("Cleaning transfers table...")
  gtfs$transfers <- gtfs$transfers[
    gtfs$transfers$from_stop_id %in% gtfs$stops$stop_id &
    gtfs$transfers$to_stop_id %in% gtfs$stops$stop_id,
  ]
}

# Fix out-of-order arrival/departure times
out_of_order_times <- gtfs$stop_times$arrival_time > gtfs$stop_times$departure_time
if (any(out_of_order_times)) {
  message(sprintf(
    "Swapping %d stop_times with arrival > departure\n",
    sum(out_of_order_times)
  ))
  temp <- gtfs$stop_times$arrival_time[out_of_order_times]
  gtfs$stop_times$arrival_time[out_of_order_times] <- gtfs$stop_times$departure_time[out_of_order_times]
  gtfs$stop_times$departure_time[out_of_order_times] <- temp
}

# Set bikes_allowed=1 for all trips
message("Setting bikes_allowed=1 for all trips...")
gtfs$trips$bikes_allowed <- 1
message(sprintf("Updated %d trips to allow bicycles\n", nrow(gtfs$trips)))

# Validate after cleaning
message("Validating GTFS (after cleaning)...")
gtfs_validate_internal(gtfs)

  message("Trimming to next full Monday-Sunday week...")

# Calculate next full week (Monday-Sunday)
today <- Sys.Date()
day_of_week <- as.integer(format(today, "%u"))  # 1=Monday, 7=Sunday
days_to_monday <- (8 - day_of_week) %% 7
if (days_to_monday == 0) days_to_monday <- 0  # Today is Monday
week_start <- today + days_to_monday
week_end <- week_start + 6

# Convert to GTFS date format (YYYYMMDD integers)
start_date <- as.integer(format(week_start, "%Y%m%d"))
end_date <- as.integer(format(week_end, "%Y%m%d"))

message(sprintf("Trimming rail GTFS to week: %s to %s (GTFS format: %d to %d)\n",
              week_start, week_end, start_date, end_date))

gtfs <- safe_execute(
gtfs_trim_dates(gtfs, startdate = start_date, enddate = end_date),
"Failed to trim GTFS dates"
)

# Validate coverage for all 7 days
message("Validating rail GTFS service coverage for all 7 days...")

# The gtfs_trim_dates function should have already validated, but let's add explicit check
if (!is.null(gtfs$calendar) && nrow(gtfs$calendar) == 0 &&
  (!is.null(gtfs$calendar_dates) && nrow(gtfs$calendar_dates) == 0)) {
stop("Rail GTFS has no service data after trimming")
}

message("✓ Rail GTFS trimmed and validated\n")

# Write output
out_zip_path <- file.path(out_dir, paste0(out_name, ".zip"))
message(sprintf("Writing GTFS to %s...\n", out_zip_path))
safe_execute(
  gtfs_write(gtfs, folder = out_dir, name = out_name),
  "Failed to write GTFS output"
)

message("=== CONVERSION COMPLETE ===")
message(sprintf("Output: %s\n", out_zip_path))
quit(status = 0)
