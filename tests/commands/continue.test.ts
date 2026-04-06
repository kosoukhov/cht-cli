import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const CONTINUE_MD = path.join(
  process.cwd(),
  "skills/cht-continue/SKILL.md",
);

describe("/cht-continue SKILL.md", () => {
  const raw = fs.readFileSync(CONTINUE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(CONTINUE_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-continue", () => {
    expect(frontmatter.name).toBe("cht-continue");
  });

  it("frontmatter contains description field", () => {
    expect(frontmatter.description).toBeDefined();
    expect(typeof frontmatter.description).toBe("string");
  });

  it("allowed-tools contains Read (for loading chat file)", () => {
    const tools = frontmatter["allowed-tools"];
    const toolStr = Array.isArray(tools) ? tools.join(" ") : String(tools);
    expect(toolStr).toContain("Read");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"];
    const toolStr = Array.isArray(tools) ? tools.join(" ") : String(tools);
    expect(toolStr).toContain("Bash(cht *)");
  });

  it("body contains session-set (activates hooks)", () => {
    expect(body).toContain("session-set");
  });

  it("body contains Read instruction (loads history)", () => {
    expect(body).toContain("Read");
  });

  it("body contains summary instruction", () => {
    expect(body.toLowerCase()).toContain("summary");
  });

  it("body does NOT contain session-clear", () => {
    expect(body).not.toContain("session-clear");
  });

  it("body contains empty-state handling", () => {
    const lower = body.toLowerCase();
    expect(lower).toMatch(/no chats found|no chats/);
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});
