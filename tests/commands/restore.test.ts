import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const RESTORE_MD = path.join(
  process.cwd(),
  ".claude/skills/cht-restore/SKILL.md",
);

describe("/cht-restore SKILL.md", () => {
  const raw = fs.readFileSync(RESTORE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(RESTORE_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-restore", () => {
    expect(frontmatter.name).toBe("cht-restore");
  });

  it("frontmatter.description is defined and contains 'restore'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("restore");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains '--archived' (uses archived list, per D-03)", () => {
    expect(body).toContain("--archived");
  });

  it("body contains cht restore (invokes CLI restore subcommand)", () => {
    expect(body).toContain("cht restore");
  });

  it("body contains 'No archived chats' (empty state)", () => {
    expect(body).toContain("No archived chats");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
