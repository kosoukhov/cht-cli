import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const NEW_MD = path.join(process.cwd(), ".claude/skills/cht-new/SKILL.md");

describe("/cht-new SKILL.md", () => {
  const raw = fs.readFileSync(NEW_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(NEW_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-new", () => {
    expect(frontmatter.name).toBe("cht-new");
  });

  it("frontmatter.description contains auto-invocation trigger", () => {
    expect(frontmatter.description).toContain("Use when the user wants to start a new conversation");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht create (invokes CLI create subcommand)", () => {
    expect(body).toContain("cht create");
  });

  it("body contains /cht-end reference (not /cht:end)", () => {
    expect(body).toContain("/cht-end");
    expect(body).not.toContain("/cht:");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
