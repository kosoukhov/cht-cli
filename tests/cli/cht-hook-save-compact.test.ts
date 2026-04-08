import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createChat, readChat } from "../../src/store/chat-store.ts";
import { setActiveChat, clearActiveChat } from "../../src/session/state.ts";

import { chtExecArgs } from "./helpers.ts";
const [chtCmd, chtArgs] = chtExecArgs();

async function runHookCommand(
  command: string,
  stdinJson: object,
  env: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      chtCmd,
      [...chtArgs, command],
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

function makePostCompactInput(trigger: "auto" | "manual") {
  return {
    session_id: "test-session",
    hook_event_name: "PostCompact",
    trigger,
    compact_summary: "Summary of compacted conversation",
  };
}

describe("cht hook-save-compact subcommand", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-hook-compact-test-"));
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

  it("appends compact marker with auto trigger", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-compact",
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(1);
    expect(chat.compactMarkers[0].trigger).toBe("auto");
  });

  it("exits 0 when no active chat", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");

    const result = await runHookCommand(
      "hook-save-compact",
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(0);
  });

  it("appends compact marker with manual trigger", async () => {
    const chatPath = await createChat(tmpDir, "general", "Test Chat");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHookCommand(
      "hook-save-compact",
      makePostCompactInput("manual"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(1);
    expect(chat.compactMarkers[0].trigger).toBe("manual");
  });
});
