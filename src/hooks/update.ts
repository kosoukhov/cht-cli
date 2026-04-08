import { checkLatestVersion } from "./version-check.ts";
import { execFileSync, execFile } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

export interface UpdateResult {
  ok: boolean;
  // Success fields
  from?: string;
  to?: string;
  setup?: string;
  doctor?: string;
  // Up-to-date fields
  upToDate?: boolean;
  version?: string;
  // Dry-run fields
  dryRun?: boolean;
  current?: string;
  latest?: string;
  // Error fields
  error?: string;
  stderr?: string;
  guidance?: string;
  // Doctor issues
  doctor_issues?: string;
}

interface UpdateOptions {
  dryRun?: boolean;
}

/**
 * Run a post-update command (cht setup / cht doctor) as a child process.
 * Uses the newly installed binary, not the current process.
 */
function runPostCommand(
  cmd: string,
): Promise<{ ok: boolean; output?: string }> {
  return new Promise((resolve) => {
    execFile(
      "cht",
      [cmd],
      { timeout: 30_000 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, output: stderr?.trim() || stdout?.trim() || error.message });
        } else {
          resolve({ ok: true, output: stdout?.trim() });
        }
      },
    );
  });
}

/**
 * Self-update the CLI package via npm install -g.
 *
 * Flow:
 * 1. Check latest version (network call)
 * 2. If up-to-date or dry-run, return early
 * 3. Proactive EACCES check on npm global prefix
 * 4. npm install -g @kosoukhov/cht-cli@latest
 * 5. Post-update: cht setup + cht doctor as child processes
 *
 * Single attempt, no retry (D-04).
 * No auto-sudo (D-03).
 */
export async function runUpdate(
  options?: UpdateOptions,
): Promise<UpdateResult> {
  // 1. Check latest version
  let info;
  try {
    info = await checkLatestVersion();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  // 2a. Dry-run: return version info without installing (D-15, D-16)
  if (options?.dryRun) {
    return {
      ok: true,
      dryRun: true,
      current: info.current,
      latest: info.latest,
      upToDate: info.upToDate,
    };
  }

  // 2b. Already up to date (D-09)
  if (info.upToDate) {
    return { ok: true, upToDate: true, version: info.current };
  }

  // 3. Proactive EACCES check (D-01)
  let globalPrefix: string;
  try {
    globalPrefix = execFileSync("npm", ["prefix", "-g"], {
      encoding: "utf-8",
    }).trim();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {
        ok: false,
        error: "npm not found on PATH. Install Node.js with npm first.",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to resolve npm prefix: ${message}` };
  }

  const libDir = path.join(globalPrefix, "lib", "node_modules");
  try {
    accessSync(libDir, constants.W_OK);
  } catch {
    return {
      ok: false,
      error: "Permission denied",
      guidance:
        "Quick fix: sudo npm install -g @kosoukhov/cht-cli\nProper fix: install Node.js via nvm to avoid permission issues",
    };
  }

  // 4. npm install (D-06) -- single attempt, no retry (D-04)
  const installResult = await new Promise<{
    ok: boolean;
    stderr?: string;
  }>((resolve) => {
    execFile(
      "npm",
      ["install", "-g", "@kosoukhov/cht-cli@latest"],
      { timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) {
          resolve({ ok: false, stderr: stderr?.trim() || error.message });
        } else {
          resolve({ ok: true });
        }
      },
    );
  });

  if (!installResult.ok) {
    return {
      ok: false,
      error: "npm install failed",
      stderr: installResult.stderr,
    };
  }

  // 5. Post-update: cht setup + cht doctor as child processes (D-10)
  const setupResult = await runPostCommand("setup");
  const doctorResult = await runPostCommand("doctor");

  // 6. Build result (D-08, D-11)
  const result: UpdateResult = {
    ok: true,
    from: info.current,
    to: info.latest,
    setup: setupResult.ok ? "ok" : "fail",
    doctor: doctorResult.ok ? "ok" : "fail",
  };

  if (!doctorResult.ok) {
    result.doctor_issues = doctorResult.output;
  }

  return result;
}
