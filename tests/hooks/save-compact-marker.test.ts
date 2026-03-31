import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createChat, readChat, appendMessage } from "../../src/store/chat-store.ts";
import { setActiveChat, clearActiveChat } from "../../src/session/state.ts";

const HOOK_SCRIPT = path.resolve(".claude/hooks/save-compact-marker.ts");

async function runHook(
  hookScript: string,
  stdinJson: object,
  env: Record<string, string>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      "node",
      ["--experimental-strip-types", hookScript],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          exitCode: (error as NodeJS.ErrnoException | null)?.code
            ? parseInt(String((error as any).code), 10) || 1
            : error
              ? 1
              : 0,
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

describe("save-compact-marker hook", () => {
  let tmpDir: string;
  let origStorageDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hook-compact-test-"));
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

  it("appends compact marker when active chat exists", async () => {
    const chatPath = await createChat(tmpDir, "general", "Compact Hook Test");
    await appendMessage(chatPath, "user", "Hello");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHook(
      HOOK_SCRIPT,
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(1);
    expect(chat.compactMarkers[0].trigger).toBe("auto");
    // Messages preserved
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].content).toBe("Hello");
  });

  it("produces no stdout output (silent operation)", async () => {
    const chatPath = await createChat(tmpDir, "general", "Silent Test");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHook(
      HOOK_SCRIPT,
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 without modifying files when no active chat", async () => {
    const chatPath = await createChat(tmpDir, "general", "No Session Test");

    const result = await runHook(
      HOOK_SCRIPT,
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(0);
  });

  it("logs error and exits 1 when chat file does not exist", async () => {
    await setActiveChat({
      chat_path: path.join(tmpDir, "general", "nonexistent.md"),
      project: "general",
    });

    const result = await runHook(
      HOOK_SCRIPT,
      makePostCompactInput("auto"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(1);

    // Verify error was logged
    const logPath = path.join(tmpDir, ".hook-errors.log");
    const logContent = await fs.readFile(logPath, "utf-8");
    expect(logContent).toContain("save-compact-marker");
  });

  it("handles manual trigger correctly", async () => {
    const chatPath = await createChat(tmpDir, "general", "Manual Trigger Test");
    await appendMessage(chatPath, "user", "Hello");
    await setActiveChat({ chat_path: chatPath, project: "general" });

    const result = await runHook(
      HOOK_SCRIPT,
      makePostCompactInput("manual"),
      { CHAT_STORAGE_DIR: tmpDir },
    );

    expect(result.exitCode).toBe(0);

    const chat = await readChat(chatPath);
    expect(chat.compactMarkers).toHaveLength(1);
    expect(chat.compactMarkers[0].trigger).toBe("manual");
  });
});
