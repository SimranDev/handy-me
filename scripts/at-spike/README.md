# AT API spike

Standalone script (not part of the app) for trying Auckland Transport's GTFS and realtime APIs.

```bash
cd scripts/at-spike
pnpm install
cp .env.example .env         # then fill in AT_API_KEY and STATION_NAME
pnpm stations                # list the station's platforms and the directions they serve
pnpm watch <stop_code>       # live departures, refreshed every 30s (add --once for a single tick)
```

Every response is saved to `samples/`, which is gitignored. Only the trimmed `samples/fixture-*.json` files are committed:

- `fixture-stops-sunnyvale-…`: Sunnyvale station, its two rail platforms, bus stops with the same name, and a stop with no `vehicle_type`.
- `fixture-stoptrips-9320-…-h23`: platform 1 from 23:00, including past-midnight `24:xx` times.
- `fixture-tripupdates-…`: three trips from the same evening. One has passed the stop (live), one is approaching with a fresh delay, and one is a stale pre-trip placeholder.

## API behaviour observed (Sept 2026)

- `stop_time_update` in `/realtime/legacy/tripupdates` came back as a single object (the stop the train is at or last passed), not an array. The code accepts both.
- Trips that haven't started yet carry a placeholder update: `delay: 0` and a `timestamp` that can be many hours old. Updates older than 15 minutes count as "scheduled", not live.
- `stoptrips` times can pass 24:00 (`24:12:00`). They are measured from the service date, so they are resolved from `service_date` in Pacific/Auckland time.
- `filter[start_hour]=0` is rejected with a 400 error. After midnight the script queries the previous service date with `start_hour=24` or later.
- `filter[start_hour]` returns trips from the whole starting hour, including ones that have already gone.
- `stop_headsign` ("Manukau via City Centre") reads better than `trip_headsign`.
- Unknown trip ids return an empty `entity` list, not an error.
