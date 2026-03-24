import { describe, it, expect } from "vitest";
import type { FileAttachment } from "../../src/attachments/reader.ts";
import {
  formatAttachmentMarkdown,
  formatAttachmentApiContent,
  formatAttachmentConfirmation,
  formatBulkAttachmentConfirmation,
} from "../../src/attachments/formatter.ts";

const textAttachment: FileAttachment = {
  type: "text",
  path: "/Users/me/project/routes.ts",
  content: 'const app = express();\napp.get("/", handler);',
  language: "typescript",
};

const imageAttachment: FileAttachment = {
  type: "image",
  path: "/Users/me/screenshots/ui.png",
  base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
  mediaType: "image/png",
};

const errorAttachment: FileAttachment = {
  type: "error",
  path: "/Users/me/data.bin",
  reason: "Binary file format not supported",
};

describe("formatAttachmentMarkdown", () => {
  it("formats text attachment as markdown blockquote + code block", () => {
    const result = formatAttachmentMarkdown(textAttachment);
    expect(result).toContain(
      "> **Attached: /Users/me/project/routes.ts** (typescript)"
    );
    expect(result).toContain("```typescript");
    expect(result).toContain('const app = express();');
    expect(result).toContain("```");
  });

  it("formats image attachment as markdown blockquote only", () => {
    const result = formatAttachmentMarkdown(imageAttachment);
    expect(result).toContain(
      "> **Attached: /Users/me/screenshots/ui.png** (image)"
    );
    // Should NOT contain code block markers
    expect(result).not.toContain("```");
  });

  it("formats error attachment as empty string", () => {
    const result = formatAttachmentMarkdown(errorAttachment);
    expect(result).toBe("");
  });

  it("uses plain backticks when language is empty string", () => {
    const txtAttachment: FileAttachment = {
      type: "text",
      path: "/Users/me/notes.txt",
      content: "Just some plain text.",
      language: "",
    };
    const result = formatAttachmentMarkdown(txtAttachment);
    expect(result).toContain("> **Attached: /Users/me/notes.txt** (text)");
    // Should have just ``` with no language tag
    const lines = result.split("\n");
    const codeStart = lines.find((l) => l.startsWith("```"));
    expect(codeStart).toBe("```");
  });
});

describe("formatAttachmentApiContent", () => {
  it("formats text attachment as API TextBlockParam", () => {
    const result = formatAttachmentApiContent(textAttachment);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("text");
    if (result!.type !== "text") throw new Error("Expected text type");
    expect(result!.text).toContain(
      "File: /Users/me/project/routes.ts"
    );
    expect(result!.text).toContain('const app = express();');
  });

  it("formats image attachment as API ImageBlockParam", () => {
    const result = formatAttachmentApiContent(imageAttachment);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("image");
    if (result!.type !== "image") throw new Error("Expected image type");
    const source = result!.source;
    expect(source.type).toBe("base64");
    if (source.type !== "base64") throw new Error("Expected base64 source");
    expect(source.media_type).toBe("image/png");
    expect(source.data).toBe(imageAttachment.base64);
  });

  it("formats error attachment as null", () => {
    const result = formatAttachmentApiContent(errorAttachment);
    expect(result).toBeNull();
  });
});

describe("formatAttachmentConfirmation", () => {
  it("formats text file confirmation with basename and size", () => {
    const result = formatAttachmentConfirmation(textAttachment, 2150);
    expect(result).toBe("Attached: routes.ts (text, 2.1KB)");
  });

  it("formats image file confirmation with basename and size", () => {
    const result = formatAttachmentConfirmation(imageAttachment, 350000);
    expect(result).toBe("Attached: ui.png (image, 341.8KB)");
  });

  it("formats error attachment as empty string", () => {
    const result = formatAttachmentConfirmation(errorAttachment, 0);
    expect(result).toBe("");
  });
});

describe("formatBulkAttachmentConfirmation", () => {
  it("formats 3 text attachments as bulk summary", () => {
    const attachments: FileAttachment[] = [
      { type: "text", path: "/Users/me/src/main.ts", content: "x", language: "typescript" },
      { type: "text", path: "/Users/me/src/utils.ts", content: "y", language: "typescript" },
      { type: "text", path: "/Users/me/src/config.json", content: "{}", language: "json" },
    ];
    const fileSizes = [2150, 890, 340];
    const result = formatBulkAttachmentConfirmation(attachments, fileSizes);
    expect(result).toBe("Attached 3 files: main.ts (2.1KB), utils.ts (890B), config.json (340B)");
  });

  it("formats 2 files with correct prefix", () => {
    const attachments: FileAttachment[] = [
      { type: "text", path: "/Users/me/a.ts", content: "a", language: "typescript" },
      { type: "text", path: "/Users/me/b.ts", content: "b", language: "typescript" },
    ];
    const fileSizes = [1024, 512];
    const result = formatBulkAttachmentConfirmation(attachments, fileSizes);
    expect(result).toMatch(/^Attached 2 files: /);
    expect(result).toContain("a.ts");
    expect(result).toContain("b.ts");
  });

  it("formats mix of text and image attachments", () => {
    const attachments: FileAttachment[] = [
      { type: "text", path: "/Users/me/main.ts", content: "x", language: "typescript" },
      { type: "image", path: "/Users/me/photo.png", base64: "abc", mediaType: "image/png" },
    ];
    const fileSizes = [2150, 350000];
    const result = formatBulkAttachmentConfirmation(attachments, fileSizes);
    expect(result).toBe("Attached 2 files: main.ts (2.1KB), photo.png (341.8KB)");
  });
});
