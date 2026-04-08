import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const CHT_PATH = path.resolve("bin/cht.ts");

describe("cht update CLI routing", () => {
  it("update command is listed in available commands", async () => {
    // Run with an unknown command to see the available commands list
    try {
      await execFileAsync(
        "node",
        ["--experimental-strip-types", CHT_PATH, "UNKNOWN_COMMAND"],
        { env: { ...process.env } },
      );
    } catch (err: unknown) {
      const execErr = err as { stdout?: string };
      if (execErr.stdout) {
        const result = JSON.parse(execErr.stdout.trim());
        expect(result.error).toContain("update");
        return;
      }
      throw err;
    }
  });

  it("update --dry-run passes dryRun flag to runUpdate", async () => {
    // We can't easily mock runUpdate in a subprocess, so we verify the
    // CLI parses --dry-run by checking hasFlag("--dry-run") is wired.
    // Instead, verify the import and case exist in the source.
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(CHT_PATH, "utf-8");
    expect(source).toContain('case "update"');
    expect(source).toContain('hasFlag("--dry-run")');
    expect(source).toContain("runUpdate({ dryRun })");
  });

  it("hook commands do NOT use outputWithNotification", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(CHT_PATH, "utf-8");

    // Extract each hook case block and verify it doesn't use outputWithNotification
    const hookCases = ["hook-save-user", "hook-save-assistant", "hook-save-compact", "hook-session-clear"];
    for (const hookCase of hookCases) {
      const caseStart = source.indexOf(`case "${hookCase}"`);
      expect(caseStart).toBeGreaterThan(-1);
      // Find the next "case " or "default:" after this case
      const nextCase = source.indexOf("case ", caseStart + 1);
      const block = source.slice(caseStart, nextCase > -1 ? nextCase : undefined);
      expect(block).not.toContain("outputWithNotification");
    }
  });

  it("user-facing commands use outputWithNotification", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(CHT_PATH, "utf-8");

    // Verify key user-facing commands use outputWithNotification
    const userFacingCases = ["create", "list", "search", "read", "delete", "doctor", "migrate"];
    for (const cmd of userFacingCases) {
      const caseStart = source.indexOf(`case "${cmd}"`);
      expect(caseStart).toBeGreaterThan(-1);
      const nextCase = source.indexOf("\n    case ", caseStart + 1);
      const block = source.slice(caseStart, nextCase > -1 ? nextCase : undefined);
      expect(block, `${cmd} should use outputWithNotification`).toContain("outputWithNotification");
    }
  });
});
