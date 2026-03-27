import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const INCLUDE_PATH = path.join(process.cwd(), ".claude/commands/cht/include.md");

describe("cht/include.md skill", () => {
  it("file exists", () => {
    expect(fs.existsSync(INCLUDE_PATH)).toBe(true);
  });

  describe("frontmatter", () => {
    it("has description containing 'context' or 'include'", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { data } = matter(raw);
      const desc = (data.description as string).toLowerCase();
      expect(desc.includes("context") || desc.includes("include")).toBe(true);
    });

    it("allowed-tools contains Read", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { data } = matter(raw);
      const tools = data["allowed-tools"] as string;
      expect(tools).toContain("Read");
    });

    it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { data } = matter(raw);
      const tools = data["allowed-tools"] as string;
      expect(tools).toContain("Bash(node --experimental-strip-types bin/cht.ts *)");
    });

    it("allowed-tools contains Bash(wc", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { data } = matter(raw);
      const tools = data["allowed-tools"] as string;
      expect(tools).toContain("Bash(wc");
    });
  });

  describe("body", () => {
    it("contains '500' threshold", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(content).toContain("500");
    });

    it("contains 'wc -l' line counting command", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(content).toContain("wc -l");
    });

    it("contains 'summarize' instruction", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(content.toLowerCase()).toContain("summarize");
    });

    it("does NOT invoke 'session-set' (only warns against it)", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      // session-set may only appear in a "Do NOT run" warning, never as an actual command
      const lines = content.split("\n").filter((l) => l.includes("session-set"));
      for (const line of lines) {
        expect(line.toLowerCase()).toContain("not");
      }
      // Must not appear as a backtick command like `session-set <path>`
      expect(content).not.toMatch(/`node\b.*session-set/);
    });

    it("contains 'Read' tool instruction", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(content).toContain("Read");
    });

    it("contains 'Background context' presentation header", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(content).toContain("Background context");
    });

    it("contains empty-state handling", () => {
      const raw = fs.readFileSync(INCLUDE_PATH, "utf-8");
      const { content } = matter(raw);
      expect(
        content.includes("No chats found") || content.includes("no messages"),
      ).toBe(true);
    });
  });
});
