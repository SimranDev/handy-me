# AT API spike

Standalone script (not part of the app) for trying Auckland Transport's GTFS and realtime APIs.

```bash
cd scripts/at-spike
pnpm install
cp .env.example .env         # then fill in AT_API_KEY and STATION_NAME
pnpm stations                # list the station's platforms and the directions they serve
pnpm watch <stop_code>       # live departures, refreshed every 30s (add --once for a single tick)
pnpm probe "<path>" <name>   # GET any AT path and save it to samples/<name>.json
```

Every response is saved to `samples/`, which is gitignored. Only the trimmed `samples/fixture-*.json` files are committed:

- `fixture-stops-sunnyvale-…`: Sunnyvale station, its two rail platforms, bus stops with the same name, and a stop with no `vehicle_type`.
- `fixture-stoptrips-9320-…-h23`: platform 1 from 23:00, including past-midnight `24:xx` times.
- `fixture-tripupdates-…`: three trips from the same evening. One has passed the stop (live), one is approaching with a fresh delay, and one is a stale pre-trip placeholder.
- `fixture-stops-rail-2026-09-26`: every rail stop (48 stations, their platforms, and one rail platform with no parent station), plus bus stops with similar names.
- `fixture-stoptrips-{9320,9321,9328}-2026-09-26-h6`: a few daytime trips per platform for Sunnyvale 1 (city-bound, two headsigns), Sunnyvale 2 (west-bound) and Swanson 1 (departures plus arrivals that terminate there).
- `fixture-tripstops-{manukau,onehunga}-2026-09-26`: `trips/{id}/stops` for a Swanson → Manukau trip and a Henderson → Onehunga trip, both through Sunnyvale 1.
- `fixture-versions-2026-09-26`: `/gtfs/v3/versions`, which the app calls to check a new API key.

## API behaviour observed (Sept 2026)

- `stop_time_update` in `/realtime/legacy/tripupdates` came back as a single object (the stop the train is at or last passed), not an array. The code accepts both.
- Trips that haven't started yet carry a placeholder update: `delay: 0` and a `timestamp` that can be many hours old. Updates older than 15 minutes count as "scheduled", not live.
- `stoptrips` times can pass 24:00 (`24:12:00`). They are measured from the service date, so they are resolved from `service_date` in Pacific/Auckland time.
- `filter[start_hour]=0` is rejected with a 400 error. After midnight the script queries the previous service date with `start_hour=24` or later.
- `filter[start_hour]` returns trips from the whole starting hour, including ones that have already gone.
- `stop_headsign` ("Manukau via City Centre") reads better than `trip_headsign`.
- Unknown trip ids return an empty `entity` list, not an error.
- `/gtfs/v3/stops?filter[date]=…&filter[stop_code]=9320` returns just that stop (about 300 bytes), so the full 2.4 MB list isn't needed to resolve a stop_code. The app uses this; the spike still fetches the full list.
- Responses can arrive gzip-compressed even without an `Accept-Encoding` request header. `fetch` handles this; raw `https.get` doesn't.
- `/gtfs/v3/versions` is tiny, so the app uses it to check a key before saving. A wrong key and a missing key both return 401.
- `/gtfs/v3/stops` only supports `filter[date]` and `filter[stop_code]`. `filter[vehicle_type]` and `filter[location_type]` return 400, and `filter[stop_name]` matches only the exact name. Station search therefore loads the full list (about 7,000 stops, 2.4 MB) and filters it locally.
- `stoptrips` returns 404 (not an empty list) when the time window has no trips, and for a platform with no services at all (Swanson platform 2).
- Trips that end at a stop appear in its `stoptrips` with `pickup_type: 1` (for example, Manukau → Swanson trips at Swanson platform 1). You can't board them.
- `/gtfs/v3/trips/{trip_id}/stops?filter[date]=…` lists the trip's platform stops in order, without `stop_sequence`. Position + 1 matched `stop_sequence` from `stoptrips` in the samples. An unknown trip returns 404.
- `filter[hour_range]` accepts at least 24, and a `start_hour` of 23 with a range of 5 returns trips up to 24:41.
- Britomart is "Waitemata Train Station" in the feed, and headsigns name the end of the line ("Manukau via City Centre"), not the city stop.
