import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const CONTINUE_MD = path.join(
  process.cwd(),
  ".claude/commands/cht/continue.md",
);

describe("/cht:continue SKILL.md", () => {
  const raw = fs.readFileSync(CONTINUE_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(CONTINUE_MD)).toBe(true);
  });

  it("frontmatter contains description field", () => {
    expect(frontmatter.description).toBeDefined();
    expect(typeof frontmatter.description).toBe("string");
  });

  it("allowed-tools contains Read (for loading chat file)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Read");
  });

  it("allowed-tools contains Bash(node --experimental-strip-types bin/cht.ts *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain(
      "Bash(node --experimental-strip-types bin/cht.ts *)",
    );
  });

  it("allowed-tools contains Bash(wc (for line counting)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(wc");
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
});
