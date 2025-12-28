# munro-access

## Generating data

**Install requirements**

- Java
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

**Analyze data**

```bash
./otp.sh # Run OpenTransitPlanner in one terminal
./analyzer/analyze.sh # This script will take hours. If interrupted run it again to generate the rest.
```
