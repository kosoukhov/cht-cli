import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the attachment subsystem
vi.mock("../../src/attachments/detector.ts", () => ({
  detectFileRefs: vi.fn(),
  cleanMessageText: vi.fn(),
}));

vi.mock("../../src/attachments/reader.ts", () => ({
  readAttachment: vi.fn(),
  formatFileSize: vi.fn(),
}));

vi.mock("../../src/attachments/formatter.ts", () => ({
  formatAttachmentMarkdown: vi.fn(),
  formatAttachmentApiContent: vi.fn(),
  formatAttachmentConfirmation: vi.fn(),
  formatBulkAttachmentConfirmation: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: vi.fn(),
  },
}));

import { parseUserInput } from "../../src/repl/input-parser.ts";
import { detectFileRefs, cleanMessageText } from "../../src/attachments/detector.ts";
import { readAttachment } from "../../src/attachments/reader.ts";
import {
  formatAttachmentMarkdown,
  formatAttachmentApiContent,
  formatAttachmentConfirmation,
  formatBulkAttachmentConfirmation,
} from "../../src/attachments/formatter.ts";
import type { FileAttachment } from "../../src/attachments/reader.ts";
import fs from "node:fs/promises";

const mockDetectFileRefs = vi.mocked(detectFileRefs);
const mockCleanMessageText = vi.mocked(cleanMessageText);
const mockReadAttachment = vi.mocked(readAttachment);
const mockFormatMarkdown = vi.mocked(formatAttachmentMarkdown);
const mockFormatApiContent = vi.mocked(formatAttachmentApiContent);
const mockFormatConfirmation = vi.mocked(formatAttachmentConfirmation);
const mockFormatBulkConfirmation = vi.mocked(formatBulkAttachmentConfirmation);
const mockStat = vi.mocked(fs.stat);

describe("parseUserInput", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns plain text when no file refs detected", async () => {
    mockDetectFileRefs.mockResolvedValue([]);
    mockCleanMessageText.mockReturnValue("hello world");

    const result = await parseUserInput("hello world");

    expect(result.text).toBe("hello world");
    expect(result.attachments).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.markdownContent).toBe("hello world");
    expect(result.apiContent).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("parses input with existing text file attachment", async () => {
    const textAttachment: FileAttachment = {
      type: "text",
      path: "/tmp/test.ts",
      content: "const x = 1;",
      language: "typescript",
    };

    mockDetectFileRefs.mockResolvedValue([{ path: "/tmp/test.ts", raw: "@/tmp/test.ts" }]);
    mockCleanMessageText.mockReturnValue("please check");
    mockReadAttachment.mockResolvedValue(textAttachment);
    mockFormatMarkdown.mockReturnValue('> **Attached: /tmp/test.ts** (typescript)\n\n```typescript\nconst x = 1;\n```');
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "File: /tmp/test.ts\n\nconst x = 1;" });
    mockFormatConfirmation.mockReturnValue("Attached: test.ts (text, 12B)");
    mockStat.mockResolvedValue({ size: 12 } as any);

    const result = await parseUserInput("check @/tmp/test.ts please");

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toBe(textAttachment);
    expect(result.markdownContent).toContain("Attached: /tmp/test.ts");
    expect(result.markdownContent).toContain("please check");
    expect(result.apiContent.length).toBeGreaterThanOrEqual(2);
  });

  it("reports error for non-existent file", async () => {
    const errorAttachment: FileAttachment = {
      type: "error",
      path: "/tmp/missing.ts",
      reason: "File not found",
    };

    mockDetectFileRefs.mockResolvedValue([{ path: "/tmp/missing.ts", raw: "@/tmp/missing.ts" }]);
    mockCleanMessageText.mockReturnValue("hello");
    mockReadAttachment.mockResolvedValue(errorAttachment);

    const result = await parseUserInput("@/tmp/missing.ts hello");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("File not found");
    expect(result.errors[0]).toContain("/tmp/missing.ts");
    expect(result.text).toBe("hello");
    expect(result.attachments).toHaveLength(0);
  });

  it("reports error for binary file", async () => {
    const errorAttachment: FileAttachment = {
      type: "error",
      path: "/tmp/data.bin",
      reason: "Binary file format not supported",
    };

    mockDetectFileRefs.mockResolvedValue([{ path: "/tmp/data.bin", raw: "@/tmp/data.bin" }]);
    mockCleanMessageText.mockReturnValue("hello");
    mockReadAttachment.mockResolvedValue(errorAttachment);

    const result = await parseUserInput("@/tmp/data.bin hello");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Unsupported file type");
    expect(result.errors[0]).toContain("/tmp/data.bin");
  });

  it("reports error for oversized file", async () => {
    const errorAttachment: FileAttachment = {
      type: "error",
      path: "/tmp/huge.ts",
      reason: "Image too large (6.0MB, max 5MB)",
    };

    mockDetectFileRefs.mockResolvedValue([{ path: "/tmp/huge.ts", raw: "@/tmp/huge.ts" }]);
    mockCleanMessageText.mockReturnValue("hello");
    mockReadAttachment.mockResolvedValue(errorAttachment);

    const result = await parseUserInput("@/tmp/huge.ts hello");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("File too large");
  });

  it("handles empty input", async () => {
    mockDetectFileRefs.mockResolvedValue([]);
    mockCleanMessageText.mockReturnValue("");

    const result = await parseUserInput("");

    expect(result.text).toBe("");
    expect(result.attachments).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.markdownContent).toBe("");
    expect(result.apiContent).toEqual([]);
  });

  it("handles multiple file refs, some valid some invalid", async () => {
    const textAttachment: FileAttachment = {
      type: "text",
      path: "/tmp/good.ts",
      content: "const y = 2;",
      language: "typescript",
    };
    const errorAttachment: FileAttachment = {
      type: "error",
      path: "/tmp/bad.bin",
      reason: "Binary file format not supported",
    };

    mockDetectFileRefs.mockResolvedValue([
      { path: "/tmp/good.ts", raw: "@/tmp/good.ts" },
      { path: "/tmp/bad.bin", raw: "@/tmp/bad.bin" },
    ]);
    mockCleanMessageText.mockReturnValue("check these");
    mockReadAttachment
      .mockResolvedValueOnce(textAttachment)
      .mockResolvedValueOnce(errorAttachment);
    mockFormatMarkdown.mockReturnValue('> **Attached: /tmp/good.ts** (typescript)\n\n```typescript\nconst y = 2;\n```');
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "File: /tmp/good.ts\n\nconst y = 2;" });
    mockFormatConfirmation.mockReturnValue("Attached: good.ts (text, 12B)");
    mockStat.mockResolvedValue({ size: 12 } as any);

    const result = await parseUserInput("@/tmp/good.ts @/tmp/bad.bin check these");

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toBe(textAttachment);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Unsupported file type");
  });

  it("uses bulk confirmation for 3 file refs", async () => {
    const att1: FileAttachment = { type: "text", path: "/tmp/a.ts", content: "a", language: "typescript" };
    const att2: FileAttachment = { type: "text", path: "/tmp/b.ts", content: "b", language: "typescript" };
    const att3: FileAttachment = { type: "text", path: "/tmp/c.ts", content: "c", language: "typescript" };

    mockDetectFileRefs.mockResolvedValue([
      { path: "/tmp/a.ts", raw: "/tmp/a.ts" },
      { path: "/tmp/b.ts", raw: "/tmp/b.ts" },
      { path: "/tmp/c.ts", raw: "/tmp/c.ts" },
    ]);
    mockCleanMessageText.mockReturnValue("");
    mockReadAttachment
      .mockResolvedValueOnce(att1)
      .mockResolvedValueOnce(att2)
      .mockResolvedValueOnce(att3);
    mockFormatMarkdown.mockReturnValue("> md");
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "file" });
    mockStat.mockResolvedValue({ size: 100 } as any);
    mockFormatBulkConfirmation.mockReturnValue("Attached 3 files: a.ts (100B), b.ts (100B), c.ts (100B)");

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseUserInput("/tmp/a.ts\n/tmp/b.ts\n/tmp/c.ts");

    expect(result.attachments).toHaveLength(3);
    expect(mockFormatBulkConfirmation).toHaveBeenCalledOnce();
    expect(mockFormatConfirmation).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("uses per-file confirmation for 1 file ref", async () => {
    const att: FileAttachment = { type: "text", path: "/tmp/single.ts", content: "x", language: "typescript" };

    mockDetectFileRefs.mockResolvedValue([{ path: "/tmp/single.ts", raw: "/tmp/single.ts" }]);
    mockCleanMessageText.mockReturnValue("");
    mockReadAttachment.mockResolvedValue(att);
    mockFormatMarkdown.mockReturnValue("> md");
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "file" });
    mockFormatConfirmation.mockReturnValue("Attached: single.ts (text, 100B)");
    mockStat.mockResolvedValue({ size: 100 } as any);

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseUserInput("/tmp/single.ts");

    expect(result.attachments).toHaveLength(1);
    expect(mockFormatConfirmation).toHaveBeenCalledOnce();
    expect(mockFormatBulkConfirmation).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("enforces 10 file cap and prints warning", async () => {
    // Create 12 file refs
    const refs = Array.from({ length: 12 }, (_, i) => ({
      path: `/tmp/file${i}.ts`,
      raw: `/tmp/file${i}.ts`,
    }));
    const textAtt = (i: number): FileAttachment => ({
      type: "text",
      path: `/tmp/file${i}.ts`,
      content: `content${i}`,
      language: "typescript",
    });

    mockDetectFileRefs.mockResolvedValue(refs);
    mockCleanMessageText.mockReturnValue("");
    // readAttachment called for only first 10
    for (let i = 0; i < 10; i++) {
      mockReadAttachment.mockResolvedValueOnce(textAtt(i));
    }
    mockFormatMarkdown.mockReturnValue("> md");
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "file" });
    mockStat.mockResolvedValue({ size: 100 } as any);
    mockFormatBulkConfirmation.mockReturnValue("Attached 10 files: ...");

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseUserInput("12 files pasted");

    expect(result.attachments).toHaveLength(10);
    expect(mockReadAttachment).toHaveBeenCalledTimes(10);
    // Warning printed to stderr
    const warningCall = stderrSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("Warning:")
    );
    expect(warningCall).toBeDefined();
    expect(warningCall![0]).toContain("12 files detected");
    expect(warningCall![0]).toContain("attaching first 10 only");
    stderrSpy.mockRestore();
  });

  it("files-only input has empty text and sends attachments", async () => {
    const att1: FileAttachment = { type: "text", path: "/tmp/a.ts", content: "a", language: "typescript" };
    const att2: FileAttachment = { type: "text", path: "/tmp/b.ts", content: "b", language: "typescript" };

    mockDetectFileRefs.mockResolvedValue([
      { path: "/tmp/a.ts", raw: "/tmp/a.ts" },
      { path: "/tmp/b.ts", raw: "/tmp/b.ts" },
    ]);
    mockCleanMessageText.mockReturnValue("");
    mockReadAttachment
      .mockResolvedValueOnce(att1)
      .mockResolvedValueOnce(att2);
    mockFormatMarkdown.mockReturnValue("> md");
    mockFormatApiContent.mockReturnValue({ type: "text" as const, text: "file" });
    mockStat.mockResolvedValue({ size: 100 } as any);
    mockFormatBulkConfirmation.mockReturnValue("Attached 2 files: a.ts (100B), b.ts (100B)");

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await parseUserInput("/tmp/a.ts\n/tmp/b.ts");

    expect(result.text).toBe("");
    expect(result.attachments).toHaveLength(2);
    // apiContent should have file blocks but no text block
    expect(result.apiContent.length).toBe(2);
    stderrSpy.mockRestore();
  });
});
