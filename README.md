# munro-access

## Requirements

- renv (Install via `Rscript -e "install.packages('renv', repos='https://cloud.r-project.org/')"`)

## Usage

```bash
> ./download_streets.sh
> ./download_timetables.sh
> ./otp.sh --build # (Caches street graph, use --buildStreet to rebuild)
```

Munro route starting coordinates were downloaded from walkhighlands (see data_sources/walkhighlands) and checked into
this repository, so you should not need to redownload them.
