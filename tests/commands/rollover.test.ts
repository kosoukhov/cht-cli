import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const ROLLOVER_MD = path.join(process.cwd(), ".claude/skills/cht-rollover/SKILL.md");

describe("/cht-rollover SKILL.md", () => {
  const raw = fs.readFileSync(ROLLOVER_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(ROLLOVER_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-rollover", () => {
    expect(frontmatter.name).toBe("cht-rollover");
  });

  it("frontmatter.description contains 'roll over'", () => {
    expect(frontmatter.description.toLowerCase()).toContain("roll over");
  });

  it("allowed-tools contains Read (for loading old chat)", () => {
    const tools = frontmatter["allowed-tools"];
    const toolStr = Array.isArray(tools) ? tools.join(" ") : String(tools);
    expect(toolStr).toContain("Read");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"];
    const toolStr = Array.isArray(tools) ? tools.join(" ") : String(tools);
    expect(toolStr).toContain("Bash(cht *)");
  });

  it("body contains cht rollover (invokes CLI rollover subcommand)", () => {
    expect(body).toContain("cht rollover");
  });

  it("body does NOT contain wc -l (dropped per D-07 minimal privileges)", () => {
    expect(body).not.toContain("wc -l");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
