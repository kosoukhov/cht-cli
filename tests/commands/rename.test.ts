import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const RENAME_MD = path.join(process.cwd(), ".claude/commands/cht/rename.md");

describe("/cht:rename SKILL.md", () => {
  const raw = fs.readFileSync(RENAME_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(RENAME_MD)).toBe(true);
  });

  it("frontmatter.description is defined and contains 'rename'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("rename");
  });

  it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain(
      "Bash(node --experimental-strip-types bin/cht.ts *)",
    );
  });

  it("body contains bin/cht.ts rename (invokes CLI rename subcommand)", () => {
    expect(body).toContain("bin/cht.ts rename");
  });

  it("body contains bin/cht.ts list (lists chats for selection)", () => {
    expect(body).toContain("bin/cht.ts list");
  });

  it("body asks for new title", () => {
    expect(
      body.toLowerCase().includes("new title") ||
        body.includes("What should the new title be"),
    ).toBe(true);
  });

  it("body contains 'No chats found' (empty state)", () => {
    expect(body).toContain("No chats found");
  });

  it("body does NOT contain 'cannot be undone' (D-08: rename is reversible)", () => {
    expect(body).not.toContain("cannot be undone");
  });

  it("body contains 'frontmatter' (documents that only title changes, not file path)", () => {
    expect(body).toContain("frontmatter");
  });
});
