import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { writeFileAtomic } from "../../src/store/atomic-write.ts";

describe("writeFileAtomic", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "atomic-write-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes file that can be read back with identical content", async () => {
    const filePath = path.join(tmpDir, "test.md");
    const content = "---\ntitle: hello\n---\n\n## User\n\nHello world\n";

    await writeFileAtomic(filePath, content);

    const readBack = await fs.readFile(filePath, "utf-8");
    expect(readBack).toBe(content);
  });

  it("overwrites existing file content", async () => {
    const filePath = path.join(tmpDir, "overwrite.md");

    await writeFileAtomic(filePath, "original content");
    await writeFileAtomic(filePath, "new content");

    const readBack = await fs.readFile(filePath, "utf-8");
    expect(readBack).toBe("new content");
  });

  it("handles unicode content including Cyrillic", async () => {
    const filePath = path.join(tmpDir, "unicode.md");
    const content = "---\ntitle: Настройка nginx\n---\n\n## User\n\nПривет мир\n";

    await writeFileAtomic(filePath, content);

    const readBack = await fs.readFile(filePath, "utf-8");
    expect(readBack).toBe(content);
  });
});
