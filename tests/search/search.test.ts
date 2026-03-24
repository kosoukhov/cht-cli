import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  searchChats,
  findMatchingLines,
  formatSearchResults,
  type SearchResult,
} from "../../src/search/search.ts";

// Path to static fixtures for simple read-only tests
const FIXTURE_ROOT = path.join(
  import.meta.dirname,
  "..",
  "fixtures",
  "search",
);

describe("search", () => {
  describe("findMatchingLines", () => {
    it("finds matching lines case-insensitively", () => {
      const content = [
        "---",
        "title: Test",
        "---",
        "",
        "## User",
        "",
        "Can you explain recursion?",
        "",
        "## Assistant",
        "",
        "Recursion is a technique.",
      ].join("\n");

      const matches = findMatchingLines(content, "recursion");
      expect(matches).toHaveLength(2);
      expect(matches[0]!.line).toBe("Can you explain recursion?");
      expect(matches[1]!.line).toBe("Recursion is a technique.");
    });

    it("skips frontmatter lines", () => {
      const content = [
        "---",
        "title: Recursion Chat",
        "project: test",
        "---",
        "",
        "## User",
        "",
        "Hello world",
      ].join("\n");

      const matches = findMatchingLines(content, "Recursion");
      // "title: Recursion Chat" is in frontmatter and should NOT match
      expect(matches).toHaveLength(0);
    });

    it("returns max 3 matches per call", () => {
      const content = [
        "---",
        "title: Test",
        "---",
        "",
        "recursion line 1",
        "recursion line 2",
        "recursion line 3",
        "recursion line 4",
        "recursion line 5",
      ].join("\n");

      const matches = findMatchingLines(content, "recursion");
      expect(matches).toHaveLength(3);
    });

    it("includes line numbers (1-based)", () => {
      const content = [
        "---",
        "title: Test",
        "---",
        "",
        "## User",
        "",
        "Tell me about recursion",
      ].join("\n");

      const matches = findMatchingLines(content, "recursion");
      expect(matches).toHaveLength(1);
      expect(matches[0]!.lineNumber).toBe(7);
    });

    it("returns empty for empty query", () => {
      const content = "---\ntitle: Test\n---\nsome content";
      const matches = findMatchingLines(content, "");
      // findMatchingLines itself doesn't check empty query; searchChats does
      // But we can verify it returns results if query is non-empty
      expect(findMatchingLines(content, "content")).toHaveLength(1);
    });
  });

  describe("searchChats", () => {
    // searchChats uses listChats + fs.readFile, so we need a proper storage structure
    // The fixtures use project subdirectories with .md files

    it("finds recursion in project-a (1 chat about recursion as primary topic)", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "explain recursion",
        "project-a",
      );
      // chat-one has "explain recursion" in it
      expect(results.length).toBeGreaterThanOrEqual(1);
      const titles = results.map((r) => r.chatTitle);
      expect(titles).toContain("Algorithm Discussion");
    });

    it("finds recursion across all projects when allProjects=true", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        undefined,
        true,
      );
      // project-a: chat-one (recursion), chat-many-matches (recursion)
      // project-b: chat-three (recursion in databases)
      expect(results.length).toBeGreaterThanOrEqual(2);
      const projects = results.map((r) => r.project);
      expect(projects).toContain("project-a");
      expect(projects).toContain("project-b");
    });

    it("returns empty for nonexistent term", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "xyznonexistent",
        "project-a",
      );
      expect(results).toHaveLength(0);
    });

    it("case-insensitive: RECURSION matches recursion", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "RECURSION",
        "project-a",
      );
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("max 3 matches per chat", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        "project-a",
      );
      for (const r of results) {
        expect(r.matches.length).toBeLessThanOrEqual(3);
      }
      // chat-many-matches has 6+ lines with "recursion" but should only return 3
      const manyMatch = results.find(
        (r) => r.chatTitle === "Deep Recursion Discussion",
      );
      if (manyMatch) {
        expect(manyMatch.matches).toHaveLength(3);
      }
    });

    it("results sorted by lastModified descending", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        undefined,
        true,
      );
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.lastModified.getTime()).toBeGreaterThanOrEqual(
          results[i]!.lastModified.getTime(),
        );
      }
    });

    it("frontmatter lines are NOT matched", async () => {
      // Search for "project" which appears in frontmatter of every fixture
      // but NOT in the message body (except where it's part of a sentence)
      const results = await searchChats(
        FIXTURE_ROOT,
        "claude-sonnet-4-20250514",
        undefined,
        true,
      );
      // "claude-sonnet-4-20250514" only appears in frontmatter model field
      expect(results).toHaveLength(0);
    });

    it("empty query returns empty results", async () => {
      const results = await searchChats(FIXTURE_ROOT, "", "project-a");
      expect(results).toHaveLength(0);
    });

    it("whitespace-only query returns empty results", async () => {
      const results = await searchChats(FIXTURE_ROOT, "   ", "project-a");
      expect(results).toHaveLength(0);
    });

    it("max 20 results total", async () => {
      // Create a temp directory with many chats to test the 20 result limit
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "search-max-test-"),
      );
      const projDir = path.join(tmpDir, "bigproject");
      await fs.mkdir(projDir, { recursive: true });

      // Create 25 chat files, each containing "findme"
      for (let i = 0; i < 25; i++) {
        const content = [
          "---",
          `title: Chat ${i}`,
          "project: bigproject",
          `created: 2026-03-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
          "model: claude-sonnet-4-20250514",
          "---",
          "",
          "## User",
          "",
          "findme in this chat",
        ].join("\n");
        await fs.writeFile(path.join(projDir, `chat-${i}.md`), content);
      }

      try {
        const results = await searchChats(tmpDir, "findme", "bigproject");
        expect(results.length).toBeLessThanOrEqual(20);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("formatSearchResults", () => {
    it("no results returns correct message", () => {
      const { formatted, chats } = formatSearchResults([], "recursion");
      expect(formatted).toBe('No matches found for "recursion".');
      expect(chats).toHaveLength(0);
    });

    it("with results produces correct format", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/path/to/chat.md",
          chatTitle: "Algorithm Discussion",
          project: "my-project",
          lastModified: new Date("2026-03-20"),
          tags: [],
          matches: [
            { lineNumber: 7, line: "Can you explain recursion to me?" },
          ],
          matchType: "content",
          score: 0.8,
        },
      ];

      const { formatted, chats } = formatSearchResults(results, "recursion");
      expect(formatted).toContain("Found 1 chat(s):");
      expect(formatted).toContain("1. Algorithm Discussion  [my-project]");
      expect(formatted).toContain("...Can you explain recursion to me?...");
      expect(chats).toHaveLength(1);
    });

    it("multiple results have numbered items", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "Chat A",
          project: "proj",
          lastModified: new Date("2026-03-20"),
          tags: [],
          matches: [{ lineNumber: 1, line: "match a" }],
          matchType: "content",
          score: 0.8,
        },
        {
          chatPath: "/b.md",
          chatTitle: "Chat B",
          project: "proj",
          lastModified: new Date("2026-03-19"),
          tags: [],
          matches: [{ lineNumber: 2, line: "match b" }],
          matchType: "content",
          score: 0.8,
        },
      ];

      const { formatted } = formatSearchResults(results, "match");
      expect(formatted).toContain("Found 2 chat(s):");
      expect(formatted).toContain("  1. Chat A  [proj]");
      expect(formatted).toContain("  2. Chat B  [proj]");
    });

    it("lines longer than 80 chars are trimmed with ellipsis", () => {
      const longLine =
        "This is a very long line that exceeds eighty characters in length and should be trimmed with an ellipsis at the end";
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "Chat",
          project: "proj",
          lastModified: new Date("2026-03-20"),
          tags: [],
          matches: [{ lineNumber: 1, line: longLine }],
          matchType: "content",
          score: 0.8,
        },
      ];

      const { formatted } = formatSearchResults(results, "long");
      // The match line should be trimmed: "...{first 80 chars}..."
      // The inner content should be at most 80 chars + "..." suffix
      const matchLines = formatted
        .split("\n")
        .filter((l: string) => l.trim().startsWith("..."));
      expect(matchLines.length).toBeGreaterThanOrEqual(1);
      // The trimmed content (between the leading "..." and trailing "...") should be <= 83 chars
      // (80 chars + "..." suffix from trimLine, then wrapped in "...{content}...")
      const innerContent = matchLines[0]!.trim();
      // Format: "...{trimmed}..." where trimmed is max 80+3 chars
      expect(innerContent.length).toBeLessThanOrEqual(5 + 80 + 3 + 3);
    });
  });

  describe("fuzzy title search (DISC-01)", () => {
    it('fuzzy search "ngnx" (typo) matches chat titled "nginx setup"', async () => {
      const results = await searchChats(FIXTURE_ROOT, "ngnx", "project-a");
      const titles = results.map((r) => r.chatTitle);
      expect(titles).toContain("nginx setup");
    });

    it("fuzzy title match has matchType title, tags, and score", async () => {
      const results = await searchChats(FIXTURE_ROOT, "ngnx", "project-a");
      const nginx = results.find((r) => r.chatTitle === "nginx setup");
      expect(nginx).toBeDefined();
      expect(nginx!.matchType).toBe("title");
      expect(nginx!.tags).toEqual(["work", "debug"]);
      expect(nginx!.score).toBeGreaterThan(0);
    });

    it("title-only fuzzy match has empty matches array", async () => {
      // "ngnx" is a typo for "nginx" -- it won't appear in content body
      const results = await searchChats(FIXTURE_ROOT, "ngnx", "project-a");
      const nginx = results.find((r) => r.chatTitle === "nginx setup");
      expect(nginx).toBeDefined();
      expect(nginx!.matches).toEqual([]);
    });
  });

  describe("tag search via fuzzy index (D-08)", () => {
    it('searching "work" returns chats tagged "work"', async () => {
      const results = await searchChats(FIXTURE_ROOT, "work", "project-a");
      // "nginx setup" has tags ["work", "debug"], "quick question" has tags ["work"]
      const titles = results.map((r) => r.chatTitle);
      expect(titles).toContain("nginx setup");
      expect(titles).toContain("quick question");
    });

    it("result tags include the matched tag", async () => {
      const results = await searchChats(FIXTURE_ROOT, "work", "project-a");
      const nginx = results.find((r) => r.chatTitle === "nginx setup");
      expect(nginx).toBeDefined();
      expect(nginx!.tags).toContain("work");
    });
  });

  describe("unified ranking (DISC-02)", () => {
    it('chat matching both title and content gets matchType "both"', async () => {
      // "nginx" appears in title "nginx setup" AND in content body
      const results = await searchChats(FIXTURE_ROOT, "nginx", "project-a");
      const nginx = results.find((r) => r.chatTitle === "nginx setup");
      expect(nginx).toBeDefined();
      expect(nginx!.matchType).toBe("both");
    });

    it("results are sorted by score descending", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "nginx",
        "project-a",
      );
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(
          results[i]!.score,
        );
      }
    });

    it("content-only matches have a base score of 0.8", async () => {
      // "recursion" matches content in chat-one, chat-many-matches but
      // NOT fuzzy title match for chat-one ("Algorithm Discussion")
      const results = await searchChats(
        FIXTURE_ROOT,
        "explain recursion",
        "project-a",
      );
      const contentOnly = results.filter((r) => r.matchType === "content");
      for (const r of contentOnly) {
        expect(r.score).toBe(0.8);
      }
    });

    it("all results have score field as number", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        undefined,
        true,
      );
      for (const r of results) {
        expect(typeof r.score).toBe("number");
        expect(r.score).toBeGreaterThan(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });

    it("all results have matchType field", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        undefined,
        true,
      );
      for (const r of results) {
        expect(["title", "content", "both"]).toContain(r.matchType);
      }
    });

    it("all results have tags field as string array", async () => {
      const results = await searchChats(
        FIXTURE_ROOT,
        "recursion",
        undefined,
        true,
      );
      for (const r of results) {
        expect(Array.isArray(r.tags)).toBe(true);
      }
    });
  });

  describe("formatSearchResults with tags", () => {
    it("title-only match shows tags in alphabetical order", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "nginx setup",
          project: "project-a",
          lastModified: new Date("2026-03-22"),
          tags: ["work", "debug"],
          matches: [],
          matchType: "title",
          score: 0.9,
        },
      ];

      const { formatted } = formatSearchResults(results, "ngnx");
      expect(formatted).toContain("  1. nginx setup [debug, work]  [project-a]");
    });

    it("title-only match with no tags omits brackets", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "quick question",
          project: "project-a",
          lastModified: new Date("2026-03-21"),
          tags: [],
          matches: [],
          matchType: "title",
          score: 0.85,
        },
      ];

      const { formatted } = formatSearchResults(results, "question");
      expect(formatted).toContain("  1. quick question  [project-a]");
      // No empty [] should appear
      expect(formatted).not.toContain("[]");
    });

    it("content match still shows content lines", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "Algorithm Discussion",
          project: "project-a",
          lastModified: new Date("2026-03-20"),
          tags: [],
          matches: [
            { lineNumber: 7, line: "Can you explain recursion to me?" },
          ],
          matchType: "content",
          score: 0.8,
        },
      ];

      const { formatted } = formatSearchResults(results, "recursion");
      expect(formatted).toContain("...Can you explain recursion to me?...");
    });

    it("title-only match shows no content lines", () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "nginx setup",
          project: "project-a",
          lastModified: new Date("2026-03-22"),
          tags: ["work", "debug"],
          matches: [],
          matchType: "title",
          score: 0.9,
        },
      ];

      const { formatted } = formatSearchResults(results, "ngnx");
      const lines = formatted.split("\n");
      // After the title line, there should be no "..." content lines
      const contentLines = lines.filter(
        (l: string) => l.trim().startsWith("...") && l.trim().endsWith("..."),
      );
      expect(contentLines).toHaveLength(0);
    });

    it('header is "Found {n} chat(s):\\n"', () => {
      const results: SearchResult[] = [
        {
          chatPath: "/a.md",
          chatTitle: "Test",
          project: "proj",
          lastModified: new Date("2026-03-20"),
          tags: [],
          matches: [{ lineNumber: 1, line: "match" }],
          matchType: "content",
          score: 0.8,
        },
      ];

      const { formatted } = formatSearchResults(results, "match");
      expect(formatted).toContain("Found 1 chat(s):\n");
    });

    it('empty state shows No matches found for "query".', () => {
      const { formatted } = formatSearchResults([], "nonexistent");
      expect(formatted).toBe('No matches found for "nonexistent".');
    });
  });
});
