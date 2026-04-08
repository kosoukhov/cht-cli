import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:fs before importing the module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock("node:os", () => ({
  default: { homedir: () => "/mock/home" },
  homedir: () => "/mock/home",
}));

// Mock version-check to avoid importing createRequire chain
vi.mock("../../src/hooks/version-check.ts", () => ({
  compareSemver: (a: string, b: string): number => {
    const parse = (v: string) => v.split("-")[0].split(".").map(Number);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  },
}));

// Mock createRequire to provide package version
vi.mock("node:module", () => ({
  createRequire: () => {
    return (_path: string) => ({ version: "2.0.2" });
  },
}));

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  getCachePath,
  readVersionCache,
  writeVersionCache,
  isCacheStale,
  spawnBackgroundRefresh,
  getUpdateNotification,
} from "../../src/hooks/version-cache.ts";

describe("version-cache", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.XDG_CACHE_HOME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getCachePath", () => {
    it("returns ~/.cache/cht-cli/version-check.json by default", () => {
      const result = getCachePath();
      expect(result).toBe("/mock/home/.cache/cht-cli/version-check.json");
    });

    it("respects XDG_CACHE_HOME if set", () => {
      process.env.XDG_CACHE_HOME = "/custom/cache";
      const result = getCachePath();
      expect(result).toBe("/custom/cache/cht-cli/version-check.json");
    });
  });

  describe("readVersionCache", () => {
    it("returns parsed cache object when file exists and is valid JSON", () => {
      const cacheData = { latest: "2.1.0", checked_at: Date.now() };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(cacheData));

      const result = readVersionCache("/tmp/cache.json");
      expect(result).toEqual(cacheData);
    });

    it("returns null when file does not exist", () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      const result = readVersionCache("/tmp/cache.json");
      expect(result).toBeNull();
    });

    it("returns null when file contains invalid JSON", () => {
      vi.mocked(readFileSync).mockReturnValue("not valid json {{{");

      const result = readVersionCache("/tmp/cache.json");
      expect(result).toBeNull();
    });
  });

  describe("writeVersionCache", () => {
    it("writes {latest, checked_at} to cache path, creating directory if needed", () => {
      writeVersionCache("2.1.0", "/tmp/cht-cli/version-check.json");

      expect(mkdirSync).toHaveBeenCalledWith("/tmp/cht-cli", { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        "/tmp/cht-cli/version-check.json",
        expect.stringContaining('"latest":"2.1.0"'),
      );
      // Verify checked_at is present
      const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.checked_at).toBeTypeOf("number");
    });
  });

  describe("isCacheStale", () => {
    it("returns true when cache is null", () => {
      expect(isCacheStale(null)).toBe(true);
    });

    it("returns true when cache.checked_at is older than 24 hours", () => {
      const staleCache = {
        latest: "2.1.0",
        checked_at: Date.now() - 25 * 60 * 60 * 1000,
      };
      expect(isCacheStale(staleCache)).toBe(true);
    });

    it("returns false when cache.checked_at is within 24 hours", () => {
      const freshCache = {
        latest: "2.1.0",
        checked_at: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      };
      expect(isCacheStale(freshCache)).toBe(false);
    });
  });

  describe("spawnBackgroundRefresh", () => {
    it("calls spawn with detached: true and stdio: 'ignore', then unref()", () => {
      const unrefMock = vi.fn();
      vi.mocked(spawn).mockReturnValue({ unref: unrefMock } as any);

      spawnBackgroundRefresh("/tmp/cache.json");

      expect(spawn).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(["--input-type=module"]),
        expect.objectContaining({ detached: true, stdio: "ignore" }),
      );
      expect(unrefMock).toHaveBeenCalled();
    });
  });

  describe("getUpdateNotification", () => {
    it("returns null when cache is null", () => {
      expect(getUpdateNotification(null)).toBeNull();
    });

    it("returns null when current version >= cached latest (up to date)", () => {
      const cache = { latest: "2.0.2", checked_at: Date.now() };
      expect(getUpdateNotification(cache)).toBeNull();
    });

    it("returns formatted string when cached latest is newer", () => {
      const cache = { latest: "2.1.0", checked_at: Date.now() };
      const result = getUpdateNotification(cache);
      expect(result).toBe("2.0.2 \u2192 2.1.0");
    });
  });
});
