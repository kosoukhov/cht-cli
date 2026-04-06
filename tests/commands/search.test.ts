import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const SEARCH_MD = path.join(process.cwd(), ".claude/skills/cht-search/SKILL.md");

describe("/cht-search SKILL.md", () => {
  const raw = fs.readFileSync(SEARCH_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(SEARCH_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-search", () => {
    expect(frontmatter.name).toBe("cht-search");
  });

  it("frontmatter.description contains auto-invocation trigger", () => {
    expect(frontmatter.description).toContain("Use when the user asks about finding chats");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht search (invokes CLI search subcommand)", () => {
    expect(body).toContain("cht search");
  });

  it("body contains /cht-list reference (not /cht:list)", () => {
    expect(body).toContain("/cht-list");
    expect(body).not.toContain("/cht:");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
