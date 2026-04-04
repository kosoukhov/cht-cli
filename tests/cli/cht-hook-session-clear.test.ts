import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createChat } from "../../src/store/chat-store.ts";
import { setActiveChat, clearActiveChat, getActiveChat } from "../../src/session/state.ts";

const CHT_PATH = path.resolve("bin/cht.ts");

async function runHookCommand(
  command: string,
  stdinJson: object,
  env: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      "node",
      ["--experimental-strip-types", CHT_PATH, command],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? 1 : 0,
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
    child.stdin!.write(JSON.stringify(stdinJson));
    child.stdin!.end();
  });
}

function makeSessionEndInput() {
  return {
    session_id: "test-session",
    hook_event_name: "SessionEnd",
  };
}

describe("cht hook-session-clear subcommand", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-hook-session-test-"));
    origStorageDir = process.env.CHAT_STORAGE_DIR;
    process.env.CHAT_STORAGE_DIR = tmpDir;
  });

  afterEach(async () => {
    await clearActiveChat();
    if (origStorageDir === undefined) {
      delete process.env.CHAT_STORAGE_DIR;
    } else {
      process.env.CHAT_STORAGE_DIR = origStorageDir;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("clears active session", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    // Verify session exists before clearing
    const before = await getActiveChat();
    expect(before).not.toBeNull();

    const result = await runHookCommand(
      "hook-session-clear",
      makeSessionEndInput(),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const after = await getActiveChat();
    expect(after).toBeNull();
  });

  it("exits 0 when no active session exists", async () => {
    // No setActiveChat call -- session doesn't exist
    const result = await runHookCommand(
      "hook-session-clear",
      makeSessionEndInput(),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });
});
