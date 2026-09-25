import * as SecureStore from "expo-secure-store";

import {
  AtApiError,
  atGet,
  verifyApiKey,
} from "@/features/train-tracker/api/at-client";
import { devProxyAvailable } from "@/features/train-tracker/api/dev-proxy";

jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => items.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void items.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
});

jest.mock("@/features/train-tracker/api/dev-proxy", () => ({
  devProxyAvailable: jest.fn(async () => false),
  devProxyBaseUrl: () => "http://192.168.1.5:8081/at-proxy",
}));

// Made-up keys in AT's format.
const SAVED = "11111111111111111111111111111111";
const CANDIDATE = "22222222222222222222222222222222";

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

const respond = (status: number, body: unknown = {}) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

beforeEach(async () => {
  fetchMock.mockReset();
  jest.mocked(devProxyAvailable).mockResolvedValue(false);
  await SecureStore.deleteItemAsync("at-api-key");
});

describe("verifyApiKey", () => {
  it.each([
    [200, "valid"],
    [401, "invalid"],
    [403, "invalid"],
    [429, "rate-limited"],
    [500, "unavailable"],
  ])("maps HTTP %p to %p", async (status, result) => {
    fetchMock.mockReturnValueOnce(respond(status));
    await expect(verifyApiKey(CANDIDATE)).resolves.toBe(result);
  });

  it("reports a network failure separately", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(verifyApiKey(CANDIDATE)).resolves.toBe("network");
  });

  it("sends the candidate only as the subscription header, trimmed", async () => {
    fetchMock.mockReturnValueOnce(respond(200));
    await verifyApiKey(`  ${CANDIDATE}\n`);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.at.govt.nz/gtfs/v3/versions");
    expect(url).not.toContain(CANDIDATE);
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe(CANDIDATE);
  });

  it("doesn't save anything", async () => {
    fetchMock.mockReturnValueOnce(respond(200));
    await verifyApiKey(CANDIDATE);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("atGet", () => {
  it("fails fast without calling AT when no key is saved", async () => {
    await expect(atGet("/gtfs/v3/versions")).rejects.toMatchObject({
      kind: "missing-key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the saved key per request and sends it only as a header", async () => {
    await SecureStore.setItemAsync("at-api-key", SAVED);
    fetchMock.mockReturnValueOnce(respond(200, { data: [] }));
    await atGet("/gtfs/v3/versions");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain(SAVED);
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBe(SAVED);
  });

  it("prefers a saved key over the dev proxy", async () => {
    await SecureStore.setItemAsync("at-api-key", SAVED);
    jest.mocked(devProxyAvailable).mockResolvedValue(true);
    fetchMock.mockReturnValueOnce(respond(200, { data: [] }));
    await atGet("/gtfs/v3/versions");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.at.govt.nz/gtfs/v3/versions",
    );
  });

  it("goes through the dev proxy, with no key header, when none is saved", async () => {
    jest.mocked(devProxyAvailable).mockResolvedValue(true);
    fetchMock.mockReturnValueOnce(respond(200, { data: [] }));
    await atGet("/gtfs/v3/versions");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.1.5:8081/at-proxy/gtfs/v3/versions");
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("keeps the key out of errors", async () => {
    await SecureStore.setItemAsync("at-api-key", SAVED);
    fetchMock.mockReturnValueOnce(respond(401));
    const error = await atGet("/gtfs/v3/versions").then(
      () => null,
      (e: AtApiError) => e,
    );

    expect(error).toBeInstanceOf(AtApiError);
    expect(error?.kind).toBe("unauthorized");
    expect(`${error?.message} ${JSON.stringify(error)}`).not.toContain(SAVED);
  });
});
