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
} from "../../src/attachments/formatter.ts";
import type { FileAttachment } from "../../src/attachments/reader.ts";
import fs from "node:fs/promises";

const mockDetectFileRefs = vi.mocked(detectFileRefs);
const mockCleanMessageText = vi.mocked(cleanMessageText);
const mockReadAttachment = vi.mocked(readAttachment);
const mockFormatMarkdown = vi.mocked(formatAttachmentMarkdown);
const mockFormatApiContent = vi.mocked(formatAttachmentApiContent);
const mockFormatConfirmation = vi.mocked(formatAttachmentConfirmation);
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
});
