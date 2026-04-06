import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const END_MD = path.join(process.cwd(), ".claude/skills/cht-end/SKILL.md");

describe("/cht-end SKILL.md", () => {
  const raw = fs.readFileSync(END_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(END_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-end", () => {
    expect(frontmatter.name).toBe("cht-end");
  });

  it("frontmatter.description contains 'end'", () => {
    expect(frontmatter.description.toLowerCase()).toContain("end");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains cht session-get", () => {
    expect(body).toContain("cht session-get");
  });

  it("body contains cht session-clear", () => {
    expect(body).toContain("cht session-clear");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
