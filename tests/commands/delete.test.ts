import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const DELETE_MD = path.join(process.cwd(), ".claude/commands/cht/delete.md");

describe("/cht:delete SKILL.md", () => {
  const raw = fs.readFileSync(DELETE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(DELETE_MD)).toBe(true);
  });

  it("frontmatter.description is defined and contains 'delete'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("delete");
  });

  it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain(
      "Bash(node --experimental-strip-types bin/cht.ts *)",
    );
  });

  it("body contains bin/cht.ts delete (invokes CLI delete subcommand)", () => {
    expect(body).toContain("bin/cht.ts delete");
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
});
