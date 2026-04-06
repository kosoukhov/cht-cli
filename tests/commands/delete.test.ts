import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const DELETE_MD = path.join(process.cwd(), "skills/cht-delete/SKILL.md");

describe("/cht-delete SKILL.md", () => {
  const raw = fs.readFileSync(DELETE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(DELETE_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-delete", () => {
    expect(frontmatter.name).toBe("cht-delete");
  });

  it("frontmatter.description is defined and contains 'delete'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("delete");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht delete (invokes CLI delete subcommand)", () => {
    expect(body).toContain("cht delete");
  });

  it("body contains 'cannot be undone' (confirmation per D-07)", () => {
    expect(body).toContain("cannot be undone");
  });

  it("body contains confirmation step (waits for yes/y)", () => {
    expect(
      body.toLowerCase().includes("confirm") || body.includes("yes/y"),
    ).toBe(true);
  });

  it("body contains 'No chats found' (empty state handling)", () => {
    expect(body).toContain("No chats found");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
