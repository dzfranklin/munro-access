FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
  r-base \
  libgdal-dev \
  libgeos-dev \
  libproj-dev \
  libudunits2-dev \
  libcurl4-openssl-dev \
  libssl-dev \
  libxml2-dev \
  && rm -rf /var/cache/apt/archives /var/lib/apt/lists/*

WORKDIR /app

COPY entrypoint.R .

RUN Rscript entrypoint.R --setup

ENTRYPOINT ["Rscript", "entrypoint.R"]
