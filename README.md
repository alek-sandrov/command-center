# Sofia status archive

Written by `scripts/archive_status.py` (branch with the site's code) through the
"Archive live status" workflow, every 30 minutes. See the script for the format.
Times are epoch milliseconds (UTC); file names use Sofia dates.

- `events/YYYY/MM/YYYY-MM-DD.ndjson` – an item appeared (`"op": "open"`, with `data`) or is no
  longer listed (`"op": "close"`, with `first` and `last` seen). Sources: `water`,
  `water_planned`, `heating`, `warnings`, `earthquakes`, `official`.
- `snapshots/YYYY/MM/YYYY-MM-DD.ndjson` – the numbers at each run.
- `state.json` – items open at the last run.

Districts are numbered 0-23 in the order of `data/rayoni.json`.
