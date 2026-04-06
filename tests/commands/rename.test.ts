import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const RENAME_MD = path.join(process.cwd(), ".claude/skills/cht-rename/SKILL.md");

describe("/cht-rename SKILL.md", () => {
  const raw = fs.readFileSync(RENAME_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(RENAME_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-rename", () => {
    expect(frontmatter.name).toBe("cht-rename");
  });

  it("frontmatter.description is defined and contains 'rename'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("rename");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht rename (invokes CLI rename subcommand)", () => {
    expect(body).toContain("cht rename");
  });

  it("body contains cht list (lists chats for selection)", () => {
    expect(body).toContain("cht list");
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

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
