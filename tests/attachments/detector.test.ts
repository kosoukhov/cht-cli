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

describe("quoted path detection (D-09)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects standalone quoted path with spaces", async () => {
    mockExistence(["/Users/me/my file.txt"]);
    const refs = await detectFileRefs('"/Users/me/my file.txt"');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe("/Users/me/my file.txt");
    expect(refs[0]!.raw).toBe('"/Users/me/my file.txt"');
  });

  it("detects quoted path inline within message text", async () => {
    mockExistence(["/Users/me/my file.txt"]);
    const refs = await detectFileRefs('check "/Users/me/my file.txt" please');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe("/Users/me/my file.txt");
    expect(refs[0]!.raw).toBe('"/Users/me/my file.txt"');
  });

  it("skips non-existent quoted paths silently", async () => {
    mockExistence([]);
    const refs = await detectFileRefs('"/Users/me/nonexistent file.txt"');
    expect(refs).toEqual([]);
  });

  it("rejects relative quoted paths (must start with /)", async () => {
    mockExistence([]);
    const refs = await detectFileRefs('"relative/path.txt"');
    expect(refs).toEqual([]);
  });
});

describe("escaped path detection (D-09)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects standalone escaped path with backslash-space", async () => {
    mockExistence(["/Users/me/my file.txt"]);
    const refs = await detectFileRefs("/Users/me/my\\ file.txt");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe("/Users/me/my file.txt");
    expect(refs[0]!.raw).toBe("/Users/me/my\\ file.txt");
  });

  it("detects escaped path with multiple spaces", async () => {
    mockExistence(["/Users/me/path with multiple spaces.txt"]);
    const refs = await detectFileRefs("/Users/me/path\\ with\\ multiple\\ spaces.txt");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.path).toBe("/Users/me/path with multiple spaces.txt");
    expect(refs[0]!.raw).toBe("/Users/me/path\\ with\\ multiple\\ spaces.txt");
  });

  it("skips non-existent escaped paths silently", async () => {
    mockExistence([]);
    const refs = await detectFileRefs("/Users/me/missing\\ file.txt");
    expect(refs).toEqual([]);
  });
});

describe("multi-line path detection (D-13)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects 3 paths on 3 separate lines", async () => {
    mockExistence(["/Users/me/a.ts", "/Users/me/b.ts", "/Users/me/c.ts"]);
    const refs = await detectFileRefs("/Users/me/a.ts\n/Users/me/b.ts\n/Users/me/c.ts");
    expect(refs).toHaveLength(3);
    expect(refs[0]!.path).toBe("/Users/me/a.ts");
    expect(refs[1]!.path).toBe("/Users/me/b.ts");
    expect(refs[2]!.path).toBe("/Users/me/c.ts");
  });

  it("detects multi-line mix of quoted, escaped, and plain paths", async () => {
    mockExistence(["/Users/me/plain.ts", "/Users/me/my file.txt", "/Users/me/another file.ts"]);
    const input = '/Users/me/plain.ts\n"/Users/me/my file.txt"\n/Users/me/another\\ file.ts';
    const refs = await detectFileRefs(input);
    expect(refs).toHaveLength(3);
    expect(refs[0]!.path).toBe("/Users/me/plain.ts");
    expect(refs[1]!.path).toBe("/Users/me/my file.txt");
    expect(refs[2]!.path).toBe("/Users/me/another file.ts");
  });

  it("skips non-existent paths in multi-line paste", async () => {
    mockExistence(["/Users/me/a.ts", "/Users/me/c.ts"]);
    const refs = await detectFileRefs("/Users/me/a.ts\n/Users/me/missing.ts\n/Users/me/c.ts");
    expect(refs).toHaveLength(2);
    expect(refs[0]!.path).toBe("/Users/me/a.ts");
    expect(refs[1]!.path).toBe("/Users/me/c.ts");
  });
});

describe("pattern priority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("@path syntax takes priority over quoted path", async () => {
    mockExistence(["/Users/me/file.ts"]);
    const refs = await detectFileRefs('check @/Users/me/file.ts please');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.raw).toBe("@/Users/me/file.ts");
  });

  it("existing @path and standalone path tests compatibility", async () => {
    mockExistence(["/Users/me/file.ts"]);
    const refs = await detectFileRefs("/Users/me/file.ts");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.raw).toBe("/Users/me/file.ts");
  });
});

describe("cleanMessageText with new path types", () => {
  it("removes quoted path including quotes from text", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/my file.txt", raw: '"/Users/me/my file.txt"' },
    ];
    const result = cleanMessageText('check "/Users/me/my file.txt" please', refs);
    expect(result).toBe("check  please");
  });

  it("removes escaped path from text", () => {
    const refs: FileRef[] = [
      { path: "/Users/me/my file.txt", raw: "/Users/me/my\\ file.txt" },
    ];
    const result = cleanMessageText("/Users/me/my\\ file.txt", refs);
    expect(result).toBe("");
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
