import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import { detectFileRefs, cleanMessageText, type FileRef } from "../../src/attachments/detector.ts";

vi.mock("node:fs/promises");

const mockedFs = vi.mocked(fs);

function mockExistence(existingPaths: string[]) {
  mockedFs.access.mockImplementation(async (p) => {
    const pathStr = typeof p === "string" ? p : p.toString();
    if (existingPaths.includes(pathStr)) {
      return undefined;
    }
    throw new Error("ENOENT: no such file or directory");
  });
}

describe("detectFileRefs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects @/absolute/path syntax when file exists", async () => {
    mockExistence(["/Users/me/file.ts"]);
    const refs = await detectFileRefs("check @/Users/me/file.ts please");
    expect(refs).toEqual([
      { path: "/Users/me/file.ts", raw: "@/Users/me/file.ts" },
    ]);
  });

  it("returns empty when @path file does not exist", async () => {
    mockExistence([]);
    const refs = await detectFileRefs("check @/Users/me/missing.ts please");
    expect(refs).toEqual([]);
  });

  it("ignores @mention that is not a path pattern", async () => {
    mockExistence([]);
    const refs = await detectFileRefs("hello @mention world");
    expect(refs).toEqual([]);
  });

  it("detects standalone absolute path when entire input is a path", async () => {
    mockExistence(["/Users/me/file.ts"]);
    const refs = await detectFileRefs("/Users/me/file.ts");
    expect(refs).toEqual([
      { path: "/Users/me/file.ts", raw: "/Users/me/file.ts" },
    ]);
  });

  it("ignores absolute path embedded in text", async () => {
    mockExistence(["/usr/bin"]);
    const refs = await detectFileRefs("see /usr/bin in the path");
    expect(refs).toEqual([]);
  });

  it("detects @./relative paths resolved to absolute", async () => {
    const resolved = process.cwd() + "/relative/file.ts";
    mockExistence([resolved]);
    const refs = await detectFileRefs("@./relative/file.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe(resolved);
    expect(refs[0]!.raw).toBe("@./relative/file.ts");
  });

  it("detects @~/home paths resolved to absolute", async () => {
    const home = process.env.HOME || "/Users/default";
    const resolved = home + "/file.ts";
    mockExistence([resolved]);
    const refs = await detectFileRefs("@~/file.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe(resolved);
    expect(refs[0]!.raw).toBe("@~/file.ts");
  });

  it("returns empty for input with no file references", async () => {
    const refs = await detectFileRefs("no files here");
    expect(refs).toEqual([]);
  });

  it("detects multiple @paths and returns all that exist", async () => {
    mockExistence(["/Users/me/a.ts", "/Users/me/c.ts"]);
    const refs = await detectFileRefs(
      "see @/Users/me/a.ts and @/Users/me/b.ts and @/Users/me/c.ts"
    );
    expect(refs).toHaveLength(2);
    expect(refs[0]!.path).toBe("/Users/me/a.ts");
    expect(refs[1]!.path).toBe("/Users/me/c.ts");
  });

  it("does not match @ followed by non-path characters", async () => {
    const refs = await detectFileRefs("email@example.com @user @123");
    expect(refs).toEqual([]);
  });
});

describe("cleanMessageText", () => {
  it("removes detected file references from message text", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/file.ts", raw: "@/Users/me/file.ts" },
    ];
    const result = cleanMessageText("check @/Users/me/file.ts please", refs);
    expect(result).toBe("check  please");
  });

  it("returns empty string when entire input was a standalone path", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/file.ts", raw: "/Users/me/file.ts" },
    ];
    const result = cleanMessageText("/Users/me/file.ts", refs);
    expect(result).toBe("");
  });

  it("removes multiple file references", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/a.ts", raw: "@/Users/me/a.ts" },
      { path: "/Users/me/b.ts", raw: "@/Users/me/b.ts" },
    ];
    const result = cleanMessageText(
      "review @/Users/me/a.ts and @/Users/me/b.ts",
      refs
    );
    expect(result).toBe("review  and");
  });

  it("trims whitespace from result", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/file.ts", raw: "@/Users/me/file.ts" },
    ];
    const result = cleanMessageText("  @/Users/me/file.ts  ", refs);
    expect(result).toBe("");
  });
});
