import { describe, it, expect, vi, afterEach } from "vitest";
import { checkLatestVersion, compareSemver } from "../../src/hooks/version-check.ts";

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("2.0.2", "2.0.2")).toBe(0);
  });
  it("returns -1 when a < b", () => {
    expect(compareSemver("2.0.2", "2.1.0")).toBe(-1);
  });
  it("returns 1 when a > b", () => {
    expect(compareSemver("2.1.0", "2.0.2")).toBe(1);
  });
  it("handles major version differences", () => {
    expect(compareSemver("1.9.9", "2.0.0")).toBe(-1);
    expect(compareSemver("3.0.0", "2.99.99")).toBe(1);
  });
  it("treats prerelease as less than release when numeric parts equal", () => {
    expect(compareSemver("1.0.0-beta", "1.0.0")).toBe(-1);
    expect(compareSemver("1.0.0", "1.0.0-beta")).toBe(1);
  });
  it("treats both-prerelease with same numeric parts as equal", () => {
    expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBe(0);
  });
  it("still compares numeric parts correctly when prerelease present", () => {
    expect(compareSemver("1.0.0", "1.0.1-rc.1")).toBe(-1);
    expect(compareSemver("1.0.2-beta", "1.0.1")).toBe(1);
  });

  it("handles partial versions — missing patch treated as 0", () => {
    expect(compareSemver("2.0", "2.0.1")).toBe(-1);
    expect(compareSemver("2.0.1", "2.0")).toBe(1);
  });

  it("handles partial versions — missing minor and patch treated as 0", () => {
    expect(compareSemver("2", "2.0.0")).toBe(0);
    expect(compareSemver("2.0.0", "2")).toBe(0);
  });

  it("treats non-numeric segments as 0", () => {
    expect(compareSemver("abc.def.ghi", "1.0.0")).toBe(-1);
    expect(compareSemver("1.0.0", "abc.0.0")).toBe(1);
  });

  it("handles empty string as 0.0.0", () => {
    expect(compareSemver("", "1.0.0")).toBe(-1);
    expect(compareSemver("0.0.0", "")).toBe(0);
  });
});

describe("checkLatestVersion", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns upToDate true when versions match", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "2.0.2" }),
    });
    const result = await checkLatestVersion();
    expect(result.upToDate).toBe(true);
    expect(result.current).toBe("2.0.2");
    expect(result.latest).toBe("2.0.2");
  });

  it("returns upToDate false when newer version exists", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "3.0.0" }),
    });
    const result = await checkLatestVersion();
    expect(result.upToDate).toBe(false);
    expect(result.latest).toBe("3.0.0");
  });

  it("throws on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
    await expect(checkLatestVersion()).rejects.toThrow("fetch failed");
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(checkLatestVersion()).rejects.toThrow("HTTP 404");
  });

  it("throws on invalid registry response (non-string version)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 123 }),
    });
    await expect(checkLatestVersion()).rejects.toThrow("Invalid registry response");
  });

  it("calls fetch with correct URL and timeout signal", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: "2.0.2" }),
    });
    await checkLatestVersion();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/@kosoukhov/cht-cli/latest",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
