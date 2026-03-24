import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  createChat,
  readChat,
  listChats,
  appendMessage,
  updateFrontmatter,
  deleteChat,
  archiveChat,
  restoreChat,
  listArchivedChats,
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

  describe("deleteChat", () => {
    it("removes the file from disk", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Delete Me");

      // File should exist before deletion
      await fs.stat(filePath);

      await deleteChat(filePath);

      // File should no longer exist
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it("throws when file does not exist (ENOENT propagates)", async () => {
      const nonExistent = path.join(tmpDir, "myproject", "does-not-exist.md");

      await expect(deleteChat(nonExistent)).rejects.toThrow();
    });
  });

  describe("archiveChat", () => {
    it("moves file to _archive/ subdirectory", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Archive Me");

      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      // Original file should be gone
      await expect(fs.access(filePath)).rejects.toThrow();

      // Archived file should exist
      const stat = await fs.stat(archivePath);
      expect(stat.isFile()).toBe(true);

      // Should be in _archive/ directory
      expect(archivePath).toContain(path.join("myproject", "_archive"));
    });

    it("creates _archive/ directory if it does not exist", async () => {
      const filePath = await createChat(tmpDir, "myproject", "First Archive");
      const archiveDir = path.join(tmpDir, "myproject", "_archive");

      // _archive/ should not exist yet
      await expect(fs.access(archiveDir)).rejects.toThrow();

      await archiveChat(filePath, tmpDir, "myproject");

      // _archive/ should now exist
      const stat = await fs.stat(archiveDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("returns the new archive path as a string", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Return Path");

      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      expect(typeof archivePath).toBe("string");
      expect(archivePath.endsWith(".md")).toBe(true);
      expect(archivePath).toContain("_archive");
    });

    it("handles filename collision with numeric suffix", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Collision Test");
      const basename = path.basename(filePath);

      // Manually create a file at the expected archive path
      const archiveDir = path.join(tmpDir, "myproject", "_archive");
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(path.join(archiveDir, basename), "existing", "utf-8");

      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      // Should have -2 suffix
      const archiveBasename = path.basename(archivePath);
      expect(archiveBasename).toMatch(/-2\.md$/);
    });

    it("handles multiple collisions with incrementing suffixes", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Multi Collision");
      const basename = path.basename(filePath);
      const baseName = basename.replace(/\.md$/, "");

      // Manually create files at expected archive paths
      const archiveDir = path.join(tmpDir, "myproject", "_archive");
      await fs.mkdir(archiveDir, { recursive: true });
      await fs.writeFile(path.join(archiveDir, basename), "existing1", "utf-8");
      await fs.writeFile(
        path.join(archiveDir, `${baseName}-2.md`),
        "existing2",
        "utf-8",
      );

      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      // Should have -3 suffix
      const archiveBasename = path.basename(archivePath);
      expect(archiveBasename).toMatch(/-3\.md$/);
    });
  });

  describe("restoreChat", () => {
    it("moves file back from _archive/ to project root", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Restore Me");
      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      // Archived file should exist
      await fs.stat(archivePath);

      const restoredPath = await restoreChat(archivePath, tmpDir, "myproject");

      // Archived file should be gone
      await expect(fs.access(archivePath)).rejects.toThrow();

      // Restored file should exist
      const stat = await fs.stat(restoredPath);
      expect(stat.isFile()).toBe(true);

      // Should be in project root, not _archive
      expect(restoredPath).not.toContain("_archive");
      expect(restoredPath).toContain(path.join(tmpDir, "myproject"));
    });

    it("returns the new restored path", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Restore Path");
      const archivePath = await archiveChat(filePath, tmpDir, "myproject");

      const restoredPath = await restoreChat(archivePath, tmpDir, "myproject");

      expect(typeof restoredPath).toBe("string");
      expect(restoredPath.endsWith(".md")).toBe(true);
      expect(restoredPath).not.toContain("_archive");
    });
  });

  describe("listArchivedChats", () => {
    it("returns ChatListEntry[] for files in _archive/ directory", async () => {
      const filePath1 = await createChat(tmpDir, "myproject", "Archived One");
      const filePath2 = await createChat(tmpDir, "myproject", "Archived Two");

      await archiveChat(filePath1, tmpDir, "myproject");
      await archiveChat(filePath2, tmpDir, "myproject");

      const entries = await listArchivedChats(tmpDir, "myproject");

      expect(entries).toHaveLength(2);
      expect(entries[0]).toHaveProperty("path");
      expect(entries[0]).toHaveProperty("title");
      expect(entries[0]).toHaveProperty("project");
      expect(entries[0]).toHaveProperty("created");
      expect(entries[0]).toHaveProperty("lastModified");
      expect(entries[0]).toHaveProperty("preview");
    });

    it("returns empty array when _archive/ directory does not exist", async () => {
      const entries = await listArchivedChats(tmpDir, "myproject");

      expect(entries).toEqual([]);
    });

    it("returns entries sorted by lastModified descending", async () => {
      const filePath1 = await createChat(tmpDir, "myproject", "Old Chat");
      await archiveChat(filePath1, tmpDir, "myproject");

      await new Promise((r) => setTimeout(r, 50));

      const filePath2 = await createChat(tmpDir, "myproject", "New Chat");
      await archiveChat(filePath2, tmpDir, "myproject");

      const entries = await listArchivedChats(tmpDir, "myproject");

      expect(entries).toHaveLength(2);
      // Most recent first
      expect(entries[0].title).toBe("New Chat");
      expect(entries[1].title).toBe("Old Chat");
    });

    it("excludes non-.md files in _archive/", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Archived Chat");
      await archiveChat(filePath, tmpDir, "myproject");

      // Put a .txt file in _archive
      const archiveDir = path.join(tmpDir, "myproject", "_archive");
      await fs.writeFile(
        path.join(archiveDir, "notes.txt"),
        "some notes",
        "utf-8",
      );

      const entries = await listArchivedChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Archived Chat");
    });
  });

  describe("tags in listChats", () => {
    it("returns tags from frontmatter when present", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Tagged Chat");

      // Manually inject tags into the frontmatter
      const content = await fs.readFile(filePath, "utf-8");
      const updated = content.replace(
        "---\n",
        "---\ntags:\n  - work\n  - debug\n",
      );
      // Replace only the second occurrence (closing ---) is tricky,
      // so instead insert tags line before the closing ---
      // Actually the replace above adds after the opening ---, which is correct
      // because gray-matter reads between the two --- delimiters.
      // But we need to be more precise -- insert before the closing ---
      const parts = content.split("---");
      // parts[0] is empty, parts[1] is frontmatter, parts[2] is body
      const newFrontmatter = parts[1].trimEnd() + "\ntags:\n  - work\n  - debug\n";
      const updatedContent = "---" + newFrontmatter + "---" + parts.slice(2).join("---");
      await fs.writeFile(filePath, updatedContent, "utf-8");

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(entries[0].tags).toEqual(["work", "debug"]);
    });

    it("returns empty array when no tags field in frontmatter", async () => {
      await createChat(tmpDir, "myproject", "No Tags Chat");

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(entries[0].tags).toEqual([]);
    });

    it("tags field is always a string array", async () => {
      await createChat(tmpDir, "myproject", "Type Check Chat");

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(Array.isArray(entries[0].tags)).toBe(true);
    });
  });

  describe("updateFrontmatter with tags", () => {
    it("persists tags array and round-trips correctly", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Tag Roundtrip");

      await updateFrontmatter(filePath, { tags: ["work", "debug"] });

      const parsed = await readChat(filePath);
      expect(parsed.frontmatter.tags).toEqual(["work", "debug"]);
    });

    it("tags appear in listChats after updateFrontmatter", async () => {
      const filePath = await createChat(tmpDir, "myproject", "Updated Tags");

      await updateFrontmatter(filePath, { tags: ["urgent", "review"] });

      const entries = await listChats(tmpDir, "myproject");

      expect(entries).toHaveLength(1);
      expect(entries[0].tags).toEqual(["urgent", "review"]);
    });
  });
});
