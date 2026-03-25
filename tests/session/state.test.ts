import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getActiveChat,
  setActiveChat,
  clearActiveChat,
  clearIfMatches,
  ActiveChatSchema,
} from "../../src/session/state.ts";

describe("session state", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "session-state-test-"));
    process.env.CHAT_STORAGE_DIR = tmpDir;
  });

  afterEach(async () => {
    delete process.env.CHAT_STORAGE_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("getActiveChat", () => {
    it("returns null when .active-chat.json does not exist", async () => {
      const result = await getActiveChat();
      expect(result).toBeNull();
    });

    it("returns null when .active-chat.json contains invalid JSON", async () => {
      await fs.writeFile(
        path.join(tmpDir, ".active-chat.json"),
        "not valid json {{{",
        "utf-8",
      );

      const result = await getActiveChat();
      expect(result).toBeNull();
    });

    it("returns null when .active-chat.json has wrong schema (missing project)", async () => {
      await fs.writeFile(
        path.join(tmpDir, ".active-chat.json"),
        JSON.stringify({ chat_path: "/some/path.md" }),
        "utf-8",
      );

      const result = await getActiveChat();
      expect(result).toBeNull();
    });

    it("returns null when .active-chat.json has wrong schema (missing chat_path)", async () => {
      await fs.writeFile(
        path.join(tmpDir, ".active-chat.json"),
        JSON.stringify({ project: "myproject" }),
        "utf-8",
      );

      const result = await getActiveChat();
      expect(result).toBeNull();
    });

    it("returns { chat_path, project } when file is valid", async () => {
      const state = { chat_path: "/path/to/chat.md", project: "myproject" };
      await fs.writeFile(
        path.join(tmpDir, ".active-chat.json"),
        JSON.stringify(state),
        "utf-8",
      );

      const result = await getActiveChat();
      expect(result).toEqual(state);
    });
  });

  describe("setActiveChat", () => {
    it("creates .active-chat.json with correct fields", async () => {
      const state = { chat_path: "/path/to/chat.md", project: "myproject" };
      await setActiveChat(state);

      const raw = await fs.readFile(
        path.join(tmpDir, ".active-chat.json"),
        "utf-8",
      );
      const parsed = JSON.parse(raw);
      expect(parsed.chat_path).toBe("/path/to/chat.md");
      expect(parsed.project).toBe("myproject");
    });

    it("round-trips through getActiveChat", async () => {
      const state = { chat_path: "/path/to/chat.md", project: "myproject" };
      await setActiveChat(state);

      const result = await getActiveChat();
      expect(result).toEqual(state);
    });

    it("creates storage directory if it does not exist", async () => {
      const nestedDir = path.join(tmpDir, "nested", "storage");
      process.env.CHAT_STORAGE_DIR = nestedDir;

      await setActiveChat({
        chat_path: "/path/to/chat.md",
        project: "test",
      });

      const stat = await fs.stat(nestedDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("clearActiveChat", () => {
    it("removes the .active-chat.json file", async () => {
      await setActiveChat({
        chat_path: "/path/to/chat.md",
        project: "myproject",
      });

      // File should exist
      await fs.stat(path.join(tmpDir, ".active-chat.json"));

      await clearActiveChat();

      // File should be gone
      await expect(
        fs.access(path.join(tmpDir, ".active-chat.json")),
      ).rejects.toThrow();
    });

    it("does not throw when file does not exist", async () => {
      // No file exists -- should not throw
      await expect(clearActiveChat()).resolves.toBeUndefined();
    });
  });

  describe("clearIfMatches", () => {
    it("clears if active chat_path matches the given path", async () => {
      await setActiveChat({
        chat_path: "/path/to/chat.md",
        project: "myproject",
      });

      await clearIfMatches("/path/to/chat.md");

      const result = await getActiveChat();
      expect(result).toBeNull();
    });

    it("does NOT clear if active chat_path does not match", async () => {
      const state = { chat_path: "/path/to/chat.md", project: "myproject" };
      await setActiveChat(state);

      await clearIfMatches("/path/to/other.md");

      const result = await getActiveChat();
      expect(result).toEqual(state);
    });

    it("does not throw when no active chat exists", async () => {
      await expect(
        clearIfMatches("/path/to/chat.md"),
      ).resolves.toBeUndefined();
    });
  });

  describe("ActiveChatSchema", () => {
    it("validates correct shape", () => {
      const result = ActiveChatSchema.safeParse({
        chat_path: "/path/to/chat.md",
        project: "myproject",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing fields", () => {
      const result = ActiveChatSchema.safeParse({ chat_path: "/path" });
      expect(result.success).toBe(false);
    });
  });

  describe("file location", () => {
    it("uses resolveStorageRoot() + /.active-chat.json", async () => {
      await setActiveChat({
        chat_path: "/path/to/chat.md",
        project: "myproject",
      });

      // The file should be at tmpDir/.active-chat.json (since CHAT_STORAGE_DIR = tmpDir)
      const filePath = path.join(tmpDir, ".active-chat.json");
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    });
  });
});
