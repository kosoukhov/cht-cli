import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const RESTORE_MD = path.join(
  process.cwd(),
  ".claude/commands/cht/restore.md",
);

describe("/cht:restore SKILL.md", () => {
  const raw = fs.readFileSync(RESTORE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(RESTORE_MD)).toBe(true);
  });

  it("frontmatter.description is defined and contains 'restore'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("restore");
  });

  it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain(
      "Bash(node --experimental-strip-types bin/cht.ts *)",
    );
  });

  it("body contains '--archived' (uses archived list, per D-03)", () => {
    expect(body).toContain("--archived");
  });

  it("body contains bin/cht.ts restore (invokes CLI restore subcommand)", () => {
    expect(body).toContain("bin/cht.ts restore");
  });

  it("body contains 'No archived chats' (empty state)", () => {
    expect(body).toContain("No archived chats");
  });
});
