import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const LIST_MD = path.join(process.cwd(), ".claude/skills/cht-list/SKILL.md");

describe("/cht-list SKILL.md", () => {
  const raw = fs.readFileSync(LIST_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(LIST_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-list", () => {
    expect(frontmatter.name).toBe("cht-list");
  });

  it("frontmatter.description contains auto-invocation trigger", () => {
    expect(frontmatter.description).toContain("Use when the user wants to see their chats");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht list (invokes CLI list subcommand)", () => {
    expect(body).toContain("cht list");
  });

  it("body contains /cht-new reference (not /cht:new)", () => {
    expect(body).toContain("/cht-new");
    expect(body).not.toContain("/cht:");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
