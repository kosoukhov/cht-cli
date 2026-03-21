import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  readAttachment,
  extToLanguage,
  formatFileSize,
} from "../../src/attachments/reader.ts";

const FIXTURES_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "fixtures",
);

const sampleTxt = path.join(FIXTURES_DIR, "sample.txt");
const samplePng = path.join(FIXTURES_DIR, "sample.png");
const sampleBin = path.join(FIXTURES_DIR, "sample.bin");

beforeAll(async () => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  // Plain text file
  await fs.writeFile(sampleTxt, "Hello, this is a sample text file.\nLine 2.\n");

  // Minimal PNG header (16 bytes)
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
  await fs.writeFile(samplePng, pngBytes);

  // Binary file with null bytes
  const binBytes = Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff]);
  await fs.writeFile(sampleBin, binBytes);
});

afterAll(async () => {
  // Cleanup only test-created fixtures (leave dir for potential re-use)
  await fs.unlink(sampleTxt).catch(() => {});
  await fs.unlink(samplePng).catch(() => {});
  await fs.unlink(sampleBin).catch(() => {});
});

describe("readAttachment", () => {
  it("reads text file and returns content with language", async () => {
    const result = await readAttachment(sampleTxt);
    expect(result.type).toBe("text");
    if (result.type !== "text") throw new Error("Expected text type");
    expect(result.path).toBe(sampleTxt);
    expect(result.content).toContain("Hello, this is a sample text file.");
    expect(result.content).toContain("Line 2.");
    expect(result.language).toBe(""); // .txt maps to ""
  });

  it("reads image file and returns base64 with media type", async () => {
    const result = await readAttachment(samplePng);
    expect(result.type).toBe("image");
    if (result.type !== "image") throw new Error("Expected image type");
    expect(result.path).toBe(samplePng);
    expect(result.base64).toBeTruthy();
    expect(result.mediaType).toBe("image/png");
    // Verify the base64 decodes back to original bytes
    const decoded = Buffer.from(result.base64, "base64");
    expect(decoded[0]).toBe(0x89);
    expect(decoded[1]).toBe(0x50); // 'P'
  });

  it("rejects binary file with null bytes", async () => {
    const result = await readAttachment(sampleBin);
    expect(result.type).toBe("error");
    if (result.type !== "error") throw new Error("Expected error type");
    expect(result.path).toBe(sampleBin);
    expect(result.reason).toBe("Binary file format not supported");
  });

  it("returns error for non-existent file", async () => {
    const result = await readAttachment("/tmp/does-not-exist-xyz.ts");
    expect(result.type).toBe("error");
    if (result.type !== "error") throw new Error("Expected error type");
    expect(result.reason).toBe("File not found");
  });

  it("truncates text file larger than 50KB", async () => {
    const largePath = path.join(FIXTURES_DIR, "large-text.txt");
    // Create a file larger than 50KB
    const largeContent = "x".repeat(60 * 1024);
    await fs.writeFile(largePath, largeContent);

    try {
      const result = await readAttachment(largePath);
      expect(result.type).toBe("text");
      if (result.type !== "text") throw new Error("Expected text type");
      expect(result.content.length).toBeLessThan(60 * 1024);
      expect(result.content).toContain("[... truncated, file too large ...]");
    } finally {
      await fs.unlink(largePath).catch(() => {});
    }
  });

  it("rejects image larger than 5MB", async () => {
    const largePngPath = path.join(FIXTURES_DIR, "large-image.png");
    // Create a file with PNG extension but > 5MB
    // We write a file with PNG header followed by enough padding
    const header = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const padding = Buffer.alloc(6 * 1024 * 1024); // 6MB
    await fs.writeFile(largePngPath, Buffer.concat([header, padding]));

    try {
      const result = await readAttachment(largePngPath);
      expect(result.type).toBe("error");
      if (result.type !== "error") throw new Error("Expected error type");
      expect(result.reason).toContain("too large");
    } finally {
      await fs.unlink(largePngPath).catch(() => {});
    }
  });
});

describe("extToLanguage", () => {
  it("maps .ts to typescript", () => {
    expect(extToLanguage(".ts")).toBe("typescript");
  });

  it("maps .py to python", () => {
    expect(extToLanguage(".py")).toBe("python");
  });

  it("returns empty string for unknown extension", () => {
    expect(extToLanguage(".unknown")).toBe("");
  });

  it("maps .json to json", () => {
    expect(extToLanguage(".json")).toBe("json");
  });

  it("maps .sh to bash", () => {
    expect(extToLanguage(".sh")).toBe("bash");
  });
});

describe("formatFileSize", () => {
  it("formats bytes under 1024 as B", () => {
    expect(formatFileSize(500)).toBe("500B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1500000)).toBe("1.4MB");
  });

  it("formats exactly 1KB", () => {
    expect(formatFileSize(1024)).toBe("1.0KB");
  });
});
