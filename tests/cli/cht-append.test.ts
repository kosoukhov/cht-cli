import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { chtExecArgs } from "./helpers.ts";
const execFileAsync = promisify(execFile);
const [chtCmd, chtArgs] = chtExecArgs();

describe("cht append subcommand", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cht-append-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function runCht(
    ...cliArgs: string[]
  ): Promise<{ ok: boolean; [key: string]: unknown }> {
    try {
      const { stdout } = await execFileAsync(
        chtCmd,
        [...chtArgs, ...cliArgs],
        {
          env: { ...process.env, CHAT_STORAGE_DIR: tmpDir },
        },
      );
      return JSON.parse(stdout.trim());
    } catch (err: unknown) {
      const execErr = err as { stdout?: string };
      if (execErr.stdout) return JSON.parse(execErr.stdout.trim());
      throw err;
    }
  }

  async function runChtWithStdin(
    stdinContent: string,
    ...cliArgs: string[]
  ): Promise<{ ok: boolean; [key: string]: unknown }> {
    return new Promise((resolve, reject) => {
      const child = execFile(
        chtCmd,
        [...chtArgs, ...cliArgs],
        {
          env: { ...process.env, CHAT_STORAGE_DIR: tmpDir },
        },
        (error, stdout) => {
          const out =
            stdout?.trim() || (error as any)?.stdout?.trim();
          if (out) {
            resolve(JSON.parse(out));
          } else {
            reject(error || new Error("No output"));
          }
        },
      );
      child.stdin!.write(stdinContent);
      child.stdin!.end();
    });
  }

  it("append user message via stdin", async () => {
    const createResult = await runCht("create", "general", "Append Test");
    const chatPath = createResult.chat_path as string;

    await runCht("session-set", chatPath, "general");

    const appendResult = await runChtWithStdin(
      "Hello from user",
      "append",
      "user",
    );
    expect(appendResult.ok).toBe(true);
    expect(appendResult.role).toBe("user");

    const readResult = await runCht("read", chatPath);
    const chat = readResult.chat as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe("user");
    expect(chat.messages[0].content).toBe("Hello from user");
  });

  it("append assistant message via stdin", async () => {
    const createResult = await runCht("create", "general", "Append Test");
    const chatPath = createResult.chat_path as string;

    await runCht("session-set", chatPath, "general");

    const appendResult = await runChtWithStdin(
      "Response from Claude",
      "append",
      "assistant",
    );
    expect(appendResult.ok).toBe(true);
    expect(appendResult.role).toBe("assistant");

    const readResult = await runCht("read", chatPath);
    const chat = readResult.chat as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(chat.messages.length).toBe(1);
    expect(chat.messages[0].role).toBe("assistant");
    expect(chat.messages[0].content).toBe("Response from Claude");
  });

  it("append with no active session returns error", async () => {
    // No session-set call
    const result = await runChtWithStdin("content", "append", "user");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("No active chat session");
  });

  it("append with empty stdin returns error", async () => {
    const createResult = await runCht("create", "general", "Append Test");
    const chatPath = createResult.chat_path as string;
    await runCht("session-set", chatPath, "general");

    const result = await runChtWithStdin("", "append", "user");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("No content provided on stdin");
  });

  it("append with invalid role returns error", async () => {
    const result = await runChtWithStdin("content", "append", "badrole");
    expect(result.ok).toBe(false);
    expect((result.error as string).includes("Usage")).toBe(true);
  });
});
