# munro-access

## Generating data

**Install requirements**

- Java
- uv (Python package manager - Install via `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- R
- renv (Install via `Rscript -e "install.packages('renv', repos='https://cloud.r-project.org/')"`)

**Prepare data**

```bash
> ./download_streets.sh
> ./download_timetables.sh
> ./otp.sh --build # (Caches street graph, use --buildStreet to rebuild)
```

Munro route starting coordinates were downloaded from walkhighlands (see data_sources/walkhighlands) and checked into
this repository, so you should not need to redownload them.

**Transit data trimming**

The `./download_timetables.sh` script automatically trims both bus and rail transit data to the next full week (Monday-Sunday):
- Bus trimming uses a Python script (with uv for dependency management) that filters GTFS with gtfs-kit
- Rail trimming uses UK2GTFS's built-in `gtfs_trim_dates()` function in R
- Both sources are trimmed to the same week to ensure consistency
- `./otp.sh --build` extracts the week start date from the trimmed GTFS and writes it to `otp/transit_week.txt`
- The analyzer reads this file to determine which Wed/Sat/Sun dates to query

To update to a newer week, re-run from `./download_timetables.sh` onwards. The trimmed transit data represents a fixed week and won't change unless you re-run the workflow.

**Analyze data**

```bash
./otp.sh # Run OpenTransitPlanner in one terminal
./analyzer/analyze.sh # This script will take hours. If interrupted run it again to generate the rest.
```
