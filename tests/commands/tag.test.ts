import { describe, it, expect } from "vitest";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

const TAG_MD = path.join(process.cwd(), "skills/cht-tag/SKILL.md");
const LIST_MD = path.join(process.cwd(), "skills/cht-list/SKILL.md");

describe("/cht-tag SKILL.md", () => {
  const raw = fs.readFileSync(TAG_MD, "utf-8");
  const { data: frontmatter, content: body } = matter(raw);

  it("file exists", () => {
    expect(fs.existsSync(TAG_MD)).toBe(true);
  });

  it("frontmatter.name equals cht-tag", () => {
    expect(frontmatter.name).toBe("cht-tag");
  });

  it("frontmatter.description is defined and contains 'tag'", () => {
    expect(frontmatter.description).toBeDefined();
    expect(frontmatter.description.toLowerCase()).toContain("tag");
  });

  it("frontmatter argument-hint contains 'add' and 'remove'", () => {
    const hint = frontmatter["argument-hint"] as string;
    expect(hint).toContain("add");
    expect(hint).toContain("remove");
  });

  it("allowed-tools contains Bash(cht *)", () => {
    const tools = frontmatter["allowed-tools"] as string;
    expect(tools).toContain("Bash(cht *)");
  });

  it("body contains session-get (checks for active chat per D-05)", () => {
    expect(body).toContain("session-get");
  });

  it("body contains tag-add (invokes CLI tag-add subcommand)", () => {
    expect(body).toContain("tag-add");
  });

  it("body contains tag-remove (invokes CLI tag-remove subcommand)", () => {
    expect(body).toContain("tag-remove");
  });

  it("body references active chat fallback (D-05)", () => {
    const lower = body.toLowerCase();
    expect(
      lower.includes("no active chat") || lower.includes("active"),
    ).toBe(true);
  });

  it("body contains Usage hint (handles missing operation)", () => {
    expect(body).toContain("Usage");
  });

  it("body contains 'Which tag' (handles missing tag name)", () => {
    expect(body).toContain("Which tag");
  });

  it("body does NOT contain old CLI invocation", () => {
    expect(body).not.toContain("node --experimental-strip-types");
  });
});

describe("/cht-list tag display update (D-06)", () => {
  const raw = fs.readFileSync(LIST_MD, "utf-8");
  const { content: body } = matter(raw);

  it("contains [# inline tag format", () => {
    expect(body).toContain("[#");
  });

  it("does NOT contain old 'Tags: {tag1}' format", () => {
    expect(body).not.toContain("Tags: {tag1}");
  });
});
