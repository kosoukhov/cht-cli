import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const STATUS_MD = path.join(process.cwd(), ".claude/skills/cht-status/SKILL.md");

describe("/cht-status SKILL.md", () => {
  const raw = fs.readFileSync(STATUS_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(STATUS_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-status", () => {
    expect(frontmatter.name).toBe("cht-status");
  });

  it("frontmatter.description contains auto-invocation trigger", () => {
    expect(frontmatter.description).toContain("Use when the user asks how big");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht status (invokes CLI status subcommand)", () => {
    expect(body).toContain("cht status");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
