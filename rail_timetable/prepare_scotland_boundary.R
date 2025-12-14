#!/usr/bin/env Rscript

message("=== Preparing Scotland Boundary Data ===")

# Install required packages if not present
if (!require("rnaturalearth", quietly = TRUE)) {
  message("Installing rnaturalearth...")
  install.packages("rnaturalearth", repos = "https://cloud.r-project.org/")
}

if (!require("sf", quietly = TRUE)) {
  message("Installing sf...")
  install.packages("sf", repos = "https://cloud.r-project.org/")
}

library(rnaturalearth)
library(sf)

# Download Scotland boundary data from Natural Earth
message("Downloading Scotland boundary data from Natural Earth...")
scotland_highres <- tryCatch(
  {
    rnaturalearth::ne_download(
      scale = 10L,
      type = "map_subunits",
      category = "cultural",
      returnclass = "sf"
    ) |>
      subset(SU_A3 == "SCT")
  },
  error = function(e) {
    message("ERROR: Failed to download Scotland boundary data")
    message(sprintf("Details: %s", e$message))
    quit(status = 1)
  }
)

# Buffer the boundary by 1000m
message("Buffering Scotland boundary (1000m)...")
scotland <- sf::st_buffer(scotland_highres, 1000)

# Save as GeoJSON
output_file <- "scotland_boundary.geojson"
message(sprintf("Saving to %s...", output_file))
sf::st_write(scotland, output_file, delete_dsn = TRUE, quiet = TRUE)

file_size <- file.info(output_file)$size
message(sprintf("SUCCESS! Created %s (%.1f KB)", output_file, file_size / 1024))
