import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before imports
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  accessSync: vi.fn(),
  constants: { W_OK: 2 },
}));

vi.mock("../../src/hooks/version-check.ts", () => ({
  checkLatestVersion: vi.fn(),
}));

import { runUpdate } from "../../src/hooks/update.ts";
import { checkLatestVersion } from "../../src/hooks/version-check.ts";
import { execFileSync, execFile } from "node:child_process";
import { accessSync } from "node:fs";

const mockCheckLatestVersion = vi.mocked(checkLatestVersion);
const mockExecFileSync = vi.mocked(execFileSync);
const mockExecFile = vi.mocked(execFile);
const mockAccessSync = vi.mocked(accessSync);

/**
 * Helper: configure execFile mock for npm install and post-update commands.
 * By default all succeed.
 */
function setupExecFile(overrides?: {
  npmInstall?: { error?: Error | null; stderr?: string };
  chtSetup?: { error?: Error | null; output?: string };
  chtDoctor?: { error?: Error | null; output?: string };
}) {
  mockExecFile.mockImplementation(((
    cmd: string,
    args: string[],
    opts: unknown,
    cb: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    if (cmd === "npm" && args[0] === "install") {
      const o = overrides?.npmInstall;
      cb(o?.error ?? null, "", o?.stderr ?? "");
    } else if (cmd === "cht" && args[0] === "setup") {
      const o = overrides?.chtSetup;
      cb(o?.error ?? null, o?.output ?? "", "");
    } else if (cmd === "cht" && args[0] === "doctor") {
      const o = overrides?.chtDoctor;
      cb(o?.error ?? null, o?.output ?? "", "");
    }
    return {} as ReturnType<typeof execFile>;
  }) as unknown as typeof execFile);
}

describe("runUpdate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: npm prefix returns /usr/local
    mockExecFileSync.mockReturnValue("/usr/local\n");
    // Default: accessSync passes (no throw)
    mockAccessSync.mockReturnValue(undefined);
  });

  // Test 1: Already up to date (D-09)
  it("returns upToDate when already on latest version", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.0.2",
      upToDate: true,
    });

    const result = await runUpdate();

    expect(result).toEqual({
      ok: true,
      upToDate: true,
      version: "2.0.2",
    });
    // Should NOT call execFile for npm install
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  // Test 2: Successful update (D-08)
  it("returns success with from/to after successful update", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    setupExecFile();

    const result = await runUpdate();

    expect(result).toEqual({
      ok: true,
      from: "2.0.2",
      to: "2.1.0",
      setup: "ok",
      doctor: "ok",
    });
  });

  // Test 3: EACCES detected proactively (D-01, D-02, D-13)
  it("returns permission denied with guidance when no write access", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    mockAccessSync.mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = await runUpdate();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Permission denied");
    expect(result.guidance).toContain("sudo npm install -g @kosoukhov/cht-cli");
    expect(result.guidance).toContain("nvm");
    // Should NOT call execFile for npm install
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  // Test 4: npm not found on PATH (Pitfall 1)
  it("returns clear error when npm is not found on PATH", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    const enoent = new Error("spawn npm ENOENT") as Error & { code: string };
    enoent.code = "ENOENT";
    mockExecFileSync.mockImplementation(() => {
      throw enoent;
    });

    const result = await runUpdate();

    expect(result.ok).toBe(false);
    expect(result.error).toContain("npm not found");
  });

  // Test 5: npm install failure (D-12)
  it("returns error with stderr when npm install fails", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    setupExecFile({
      npmInstall: {
        error: new Error("npm ERR! code E404"),
        stderr: "npm ERR! 404 Not Found",
      },
    });

    const result = await runUpdate();

    expect(result.ok).toBe(false);
    expect(result.error).toContain("npm install failed");
    expect(result.stderr).toContain("npm ERR!");
  });

  // Test 6: Network/registry unreachable (D-14)
  it("returns error when version check fails due to network", async () => {
    mockCheckLatestVersion.mockRejectedValue(
      new Error("fetch failed: network timeout"),
    );

    const result = await runUpdate();

    expect(result.ok).toBe(false);
    expect(result.error).toContain("fetch failed");
  });

  // Test 7: Dry-run mode when not up to date (D-15, D-16)
  it("returns version info without installing in dry-run mode", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });

    const result = await runUpdate({ dryRun: true });

    expect(result).toEqual({
      ok: true,
      dryRun: true,
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    // Should NOT call execFile for npm install
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  // Test 8: Dry-run when already up to date (D-16)
  it("returns upToDate info in dry-run mode when already latest", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.0.2",
      upToDate: true,
    });

    const result = await runUpdate({ dryRun: true });

    expect(result).toEqual({
      ok: true,
      dryRun: true,
      current: "2.0.2",
      latest: "2.0.2",
      upToDate: true,
    });
    // Should NOT call execFile for npm install
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  // Test 9: Doctor issues after update (D-11)
  it("returns ok with doctor_issues when doctor reports problems", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    setupExecFile({
      chtDoctor: {
        error: new Error("doctor found issues"),
        output: "Missing skill: cht-archive",
      },
    });

    const result = await runUpdate();

    expect(result.ok).toBe(true);
    expect(result.from).toBe("2.0.2");
    expect(result.to).toBe("2.1.0");
    expect(result.setup).toBe("ok");
    expect(result.doctor).toBe("fail");
    expect(result.doctor_issues).toBeDefined();
  });

  // Test 10: Single attempt, no retry (D-04)
  it("returns immediately on failure without retrying", async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: "2.0.2",
      latest: "2.1.0",
      upToDate: false,
    });
    setupExecFile({
      npmInstall: {
        error: new Error("install failed"),
        stderr: "connection reset",
      },
    });

    const result = await runUpdate();

    expect(result.ok).toBe(false);
    // execFile called exactly once for npm install (not retried)
    const npmInstallCalls = mockExecFile.mock.calls.filter(
      (call) => call[0] === "npm" && (call[1] as string[])[0] === "install",
    );
    expect(npmInstallCalls).toHaveLength(1);
  });
});
