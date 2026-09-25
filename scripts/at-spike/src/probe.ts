/**
 * GET any AT API path and save the response to samples/<name>.json, for
 * trying endpoints and capturing new test fixtures.
 *
 *   pnpm probe "/gtfs/v3/versions" versions
 */
import { atGet, callCount } from "./at.ts";

const [pathAndQuery, name] = process.argv.slice(2);
if (!pathAndQuery?.startsWith("/") || !name) {
  console.error('Usage: pnpm probe "<path and query>" <sample name>');
  process.exit(1);
}

const body = await atGet<unknown>(pathAndQuery, name);
const data = (body as { data?: unknown }).data;
console.log(
  Array.isArray(data)
    ? `${data.length} items saved to samples/${name}.json`
    : `Saved to samples/${name}.json`,
);
console.log(`(${callCount()} AT API calls)`);
