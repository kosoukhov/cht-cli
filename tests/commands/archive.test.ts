import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const ARCHIVE_MD = path.join(
  process.cwd(),
  ".claude/commands/cht/archive.md",
);

describe("/cht:archive SKILL.md", () => {
  const raw = fs.readFileSync(ARCHIVE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(ARCHIVE_MD)).toBe(true);
  });

  it("frontmatter.description is defined and contains 'archive'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("archive");
  });

  it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain(
      "Bash(node --experimental-strip-types bin/cht.ts *)",
    );
  });

  it("body contains bin/cht.ts archive (invokes CLI archive subcommand)", () => {
    expect(body).toContain("bin/cht.ts archive");
  });

  it("body contains bin/cht.ts list (lists chats for selection)", () => {
    expect(body).toContain("bin/cht.ts list");
  });

  it("body does NOT contain 'cannot be undone' (D-08: archive is reversible)", () => {
    expect(body).not.toContain("cannot be undone");
  });

  it("body contains 'No chats found' (empty state)", () => {
    expect(body).toContain("No chats found");
  });

  it("body contains '/cht:restore' (tells user how to reverse)", () => {
    expect(body).toContain("/cht:restore");
  });
});
