FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  libgdal-dev \
  libgeos-dev \
  libproj-dev \
  libudunits2-dev \
  libcurl4-openssl-dev \
  libssl-dev \
  libxml2-dev \
  r-cran-remotes \
  r-cran-sf \
  r-cran-dplyr \
  r-cran-digest \
  r-cran-data.table \
  r-cran-stringr \
  r-cran-stringi \
  r-cran-future \
  r-cran-purrr \
  r-cran-furrr \
  r-cran-xml2 \
  r-cran-lubridate \
  r-cran-httr \
  r-cran-checkmate \
  r-cran-zip \
  && rm -rf /var/cache/apt/archives /var/lib/apt/lists/*

WORKDIR /app

COPY entrypoint.R .
COPY scotland_boundary.geojson .

RUN Rscript entrypoint.R --setup

ENTRYPOINT ["Rscript", "entrypoint.R"]
