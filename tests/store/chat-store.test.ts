import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createChat,
  readChat,
  listChats,
  appendMessage,
} from "../../src/store/chat-store.ts";

describe("chat-store", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-store-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("createChat", () => {
    it("creates a valid markdown file in the project directory", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Hello World");

      // File should exist
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);

      // File should be in the project directory
      expect(filePath).toContain(path.join(tmpDir, "myproject"));

      // File should be valid parseable chat
      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("title: Hello World");
      expect(content).toContain("project: myproject");
      expect(content).toContain("model:");
    });

    it("auto-creates project directory", async () => {
      const projectDir = path.join(tmpDir, "newproject");

      // Directory should not exist yet
      await expect(fs.access(projectDir)).rejects.toThrow();

      await createChat(tmpDir, "newproject", "Test Chat");

      // Directory should now exist
      const stat = await fs.stat(projectDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("defaults to general project", async () => {
      const filePath = await createChat(tmpDir, "general", "Test Chat");

      expect(filePath).toContain(path.join(tmpDir, "general"));

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("project: general");
    });

    it("handles filename collision with numeric suffix", async () => {
      // Create two chats with the same title -- they get the same date-slug
      const path1 = await createChat(tmpDir, "myproject", "Same Title");
      const path2 = await createChat(tmpDir, "myproject", "Same Title");

      // Both files should exist
      const stat1 = await fs.stat(path1);
      const stat2 = await fs.stat(path2);
      expect(stat1.isFile()).toBe(true);
      expect(stat2.isFile()).toBe(true);

      // They should be different files
      expect(path1).not.toBe(path2);

      // Second file should have -2 suffix
      const basename2 = path.basename(path2);
      expect(basename2).toMatch(/-2\.md$/);
    });

    it("uses custom model when provided", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Test", {
        model: "claude-opus-4-20250514",
      });

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("model: claude-opus-4-20250514");
    });

    it("includes system prompt in frontmatter when provided", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Test", {
        systemPrompt: "You are a helpful assistant.",
      });

      const content = await fs.readFile(filePath, "utf-8");
      expect(content).toContain("system_prompt");
      expect(content).toContain("You are a helpful assistant.");
    });
  });

  describe("readChat", () => {
    it("returns ParsedChat with frontmatter and messages", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Read Test");

      // Append some messages
      await appendMessage(filePath, "user", "Hello there");
      await appendMessage(filePath, "assistant", "Hi! How can I help?");

      const parsed = await readChat(filePath);

      expect(parsed.frontmatter.title).toBe("Read Test");
      expect(parsed.frontmatter.project).toBe("myproject");
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0].role).toBe("user");
      expect(parsed.messages[0].content).toBe("Hello there");
      expect(parsed.messages[1].role).toBe("assistant");
      expect(parsed.messages[1].content).toBe("Hi! How can I help?");
    });
  });

  describe("listChats", () => {
    it("returns entries sorted by lastModified descending", async () => {
      // Create 3 chats with slight time delays to ensure different mtimes
      const path1 = await createChat(tmpDir, "myproject", "First Chat");
      // Touch file to ensure different mtime
      await new Promise((r) => setTimeout(r, 50));
      const path2 = await createChat(tmpDir, "myproject", "Second Chat");
      await new Promise((r) => setTimeout(r, 50));
      const path3 = await createChat(tmpDir, "myproject", "Third Chat");

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(3);
      // Most recent first
      expect(entries[0].title).toBe("Third Chat");
      expect(entries[1].title).toBe("Second Chat");
      expect(entries[2].title).toBe("First Chat");
    });

    it("includes title, date, project, and preview", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Preview Test");
      await appendMessage(filePath, "user", "What is the meaning of life?");
      await appendMessage(
        filePath,
        "assistant",
        "The meaning of life is a philosophical question.",
      );

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry.title).toBe("Preview Test");
      expect(entry.project).toBe("myproject");
      expect(entry.created).toBeTruthy();
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.preview).toBeTruthy();
      expect(entry.preview.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it("excludes files starting with _", async () => {
      // Create a chat and a _config.yaml
      await createChat(tmpDir, "myproject", "Real Chat");

      const configPath = path.join(tmpDir, "myproject", "_config.yaml");
      await fs.writeFile(configPath, "system_prompt: test\n", "utf-8");

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Real Chat");
    });

    it("returns empty array for empty project directory", async () => {
      const projectDir = path.join(tmpDir, "emptyproject");
      await fs.mkdir(projectDir, { recursive: true });

      const entries = await listChats(tmpDir, "emptyproject");

      expect(entries).toHaveLength(0);
    });
  });

  describe("appendMessage", () => {
    it("adds message and persists atomically", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Append Test");

      await appendMessage(filePath, "user", "Hello");
      await appendMessage(filePath, "assistant", "Hi there!");

      const parsed = await readChat(filePath);
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0].role).toBe("user");
      expect(parsed.messages[0].content).toBe("Hello");
      expect(parsed.messages[1].role).toBe("assistant");
      expect(parsed.messages[1].content).toBe("Hi there!");
    });

    it("preserves existing messages", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Preserve Test");

      await appendMessage(filePath, "user", "Message 1");
      await appendMessage(filePath, "assistant", "Response 1");
      await appendMessage(filePath, "user", "Message 2");

      const parsed = await readChat(filePath);
      expect(parsed.messages).toHaveLength(3);
      expect(parsed.messages[0].content).toBe("Message 1");
      expect(parsed.messages[1].content).toBe("Response 1");
      expect(parsed.messages[2].content).toBe("Message 2");
    });

    it("handles messages with code blocks correctly", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Code Test");

      const codeContent = "Here is some code:\n\n```typescript\nconst x = 1;\n## User\nconsole.log(x);\n```\n\nDone.";
      await appendMessage(filePath, "user", "Show me code");
      await appendMessage(filePath, "assistant", codeContent);

      const parsed = await readChat(filePath);
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[1].content).toBe(codeContent);
    });
  });
});
