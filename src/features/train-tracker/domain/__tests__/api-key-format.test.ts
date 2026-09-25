import {
  checkApiKeyFormat,
  describeKeyCheck,
  maskApiKey,
} from "@/features/train-tracker/domain/api-key-format";

// A made-up key in AT's format (32 hex characters).
const KEY = "0123456789abcdef0123456789abcdef";

describe("checkApiKeyFormat", () => {
  it("accepts a key, trimming what's pasted around it", () => {
    expect(checkApiKeyFormat(`  ${KEY}\n`)).toEqual({ ok: true, key: KEY });
  });

  it.each([
    ["", "Paste your API key first."],
    ["   ", "Paste your API key first."],
    [`${KEY.slice(0, 16)} ${KEY.slice(16)}`, expect.stringContaining("spaces")],
    ["abc123", expect.stringContaining("too short")],
    ["a".repeat(129), expect.stringContaining("too long")],
  ])("rejects %p", (input, message) => {
    expect(checkApiKeyFormat(input)).toEqual({ ok: false, message });
  });

  it("never echoes the key in its messages", () => {
    const result = checkApiKeyFormat(`${KEY} extra`);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});

describe("maskApiKey", () => {
  it("shows only the last 4 characters", () => {
    expect(maskApiKey(KEY)).toBe("•••• cdef");
    expect(maskApiKey(KEY)).not.toContain(KEY.slice(0, -4));
  });
});

describe("describeKeyCheck", () => {
  it("tells an invalid key apart from a network failure", () => {
    expect(describeKeyCheck("invalid")).toMatch(/didn't accept this key/);
    expect(describeKeyCheck("network")).toMatch(/Couldn't reach/);
    expect(describeKeyCheck("network")).toMatch(/Nothing was saved/);
    expect(describeKeyCheck("rate-limited")).toMatch(/too many requests/);
    expect(describeKeyCheck("unavailable")).toMatch(/Try again/);
  });
});
