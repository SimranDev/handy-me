import { createAtDevProxy, upstreamUrl } from "../at-dev-proxy";

// A made-up key in AT's format.
const KEY = "33333333333333333333333333333333";

type FakeRes = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  headersSent: boolean;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
  done: Promise<void>;
};

function fakeRes(): FakeRes {
  let finish = () => {};
  const res: FakeRes = {
    statusCode: 200,
    headers: {},
    body: "",
    headersSent: false,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    end(body) {
      res.body = body?.toString() ?? "";
      res.headersSent = true;
      finish();
    },
    done: new Promise((resolve) => (finish = resolve)),
  };
  return res;
}

async function request(
  url: string,
  { method = "GET", key = KEY as string | null, fetchImpl = jest.fn() } = {},
) {
  const res = fakeRes();
  const handled = createAtDevProxy({ getKey: () => key, fetchImpl })(
    { url, method },
    res,
  );
  if (handled) await res.done;
  return { handled, res, fetchImpl };
}

describe("upstreamUrl", () => {
  it.each([
    ["/at-proxy/gtfs/v3/versions", "https://api.at.govt.nz/gtfs/v3/versions"],
    [
      "/at-proxy/gtfs/v3/stops?filter[date]=2026-09-26&filter[stop_code]=9320",
      "https://api.at.govt.nz/gtfs/v3/stops?filter[date]=2026-09-26&filter[stop_code]=9320",
    ],
    [
      "/at-proxy/realtime/legacy/tripupdates?tripid=a,b",
      "https://api.at.govt.nz/realtime/legacy/tripupdates?tripid=a,b",
    ],
  ])("forwards %s", (url, target) => {
    expect(upstreamUrl(url)).toBe(target);
  });

  it.each([
    "/index.bundle",
    "/at-proxy/other/path",
    "/at-proxy/gtfs/../../index.bundle",
    "/at-proxy//evil.example/gtfs/x",
    "/at-proxy/gtfs/./x",
    "/at-proxyx/gtfs/v3/versions",
  ])("refuses %s", (url) => {
    expect(upstreamUrl(url)).toBeNull();
  });
});

describe("createAtDevProxy", () => {
  it("leaves other requests to Metro", async () => {
    expect((await request("/index.bundle")).handled).toBe(false);
  });

  it("reports whether it has a key, without revealing it", async () => {
    const withKey = await request("/at-proxy/status");
    expect(JSON.parse(withKey.res.body)).toEqual({ available: true });
    expect(withKey.res.body).not.toContain(KEY);

    const without = await request("/at-proxy/status", { key: null });
    expect(JSON.parse(without.res.body)).toEqual({ available: false });
  });

  it("adds the key as the subscription header and passes the reply back", async () => {
    const fetchImpl = jest.fn(
      async () =>
        new Response('{"data":[]}', {
          status: 200,
          headers: { "Content-Type": "application/json", "Set-Cookie": "x=1" },
        }),
    );
    const { res } = await request("/at-proxy/gtfs/v3/versions", { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.at.govt.nz/gtfs/v3/versions");
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe(KEY);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"data":[]}');
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("passes AT's errors through, like 404 for an empty window", async () => {
    const fetchImpl = jest.fn(async () => new Response("{}", { status: 404 }));
    const { res } = await request("/at-proxy/gtfs/v3/stops/x/stoptrips", {
      fetchImpl,
    });
    expect(res.statusCode).toBe(404);
  });

  it("answers 502 when AT can't be reached", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const { res } = await request("/at-proxy/gtfs/v3/versions", { fetchImpl });
    expect(res.statusCode).toBe(502);
  });

  it("refuses non-GET, unknown paths and a missing key", async () => {
    const post = await request("/at-proxy/gtfs/v3/versions", {
      method: "POST",
    });
    const unknown = await request("/at-proxy/other");
    const noKey = await request("/at-proxy/gtfs/v3/versions", { key: null });
    expect([post, unknown, noKey].map((r) => r.res.statusCode)).toEqual([
      405, 404, 503,
    ]);
    expect(
      [post, unknown, noKey].every((r) => r.fetchImpl.mock.calls.length === 0),
    ).toBe(true);
  });
});
