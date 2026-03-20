import { describe, it, expect } from "vitest";
import {
  validateProjectName,
  resolveProjectDir,
  resolveChatPath,
  resolveStorageRoot,
  DEFAULT_PROJECT,
} from "../../src/utils/paths.ts";

describe("validateProjectName", () => {
  it("accepts simple alphanumeric name", () => {
    expect(validateProjectName("infra")).toBe(true);
  });

  it("accepts hyphenated name", () => {
    expect(validateProjectName("my-project")).toBe(true);
  });

  it("accepts underscored name", () => {
    expect(validateProjectName("my_project")).toBe(true);
  });

  it("rejects path traversal", () => {
    expect(validateProjectName("../evil")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateProjectName("")).toBe(false);
  });

  it("rejects name with spaces", () => {
    expect(validateProjectName("has spaces")).toBe(false);
  });

  it("rejects name with slash", () => {
    expect(validateProjectName("has/slash")).toBe(false);
  });

  it("rejects dot", () => {
    expect(validateProjectName(".")).toBe(false);
  });

  it("rejects double dot", () => {
    expect(validateProjectName("..")).toBe(false);
  });

  it("rejects names longer than 100 characters", () => {
    expect(validateProjectName("a".repeat(101))).toBe(false);
  });

  it("accepts names up to 100 characters", () => {
    expect(validateProjectName("a".repeat(100))).toBe(true);
  });
});

describe("resolveProjectDir", () => {
  it("resolves valid project under storage root", () => {
    expect(resolveProjectDir("/root", "infra")).toBe("/root/infra");
  });

  it("throws on invalid project name (traversal)", () => {
    expect(() => resolveProjectDir("/root", "../evil")).toThrow(
      /Invalid project name/
    );
  });

  it("throws on empty project name", () => {
    expect(() => resolveProjectDir("/root", "")).toThrow(
      /Invalid project name/
    );
  });
});

describe("resolveChatPath", () => {
  it("resolves valid chat path under project directory", () => {
    expect(resolveChatPath("/root", "infra", "chat.md")).toBe(
      "/root/infra/chat.md"
    );
  });

  it("throws on path traversal in filename", () => {
    expect(() => resolveChatPath("/root", "infra", "../evil.md")).toThrow(
      /Chat path escapes project directory/
    );
  });
});

describe("resolveStorageRoot", () => {
  it("returns CHAT_STORAGE_DIR if set", () => {
    const original = process.env.CHAT_STORAGE_DIR;
    process.env.CHAT_STORAGE_DIR = "/custom/path";
    try {
      expect(resolveStorageRoot()).toBe("/custom/path");
    } finally {
      if (original === undefined) {
        delete process.env.CHAT_STORAGE_DIR;
      } else {
        process.env.CHAT_STORAGE_DIR = original;
      }
    }
  });

  it("defaults to cwd/chats if CHAT_STORAGE_DIR not set", () => {
    const original = process.env.CHAT_STORAGE_DIR;
    delete process.env.CHAT_STORAGE_DIR;
    try {
      expect(resolveStorageRoot()).toContain("chats");
    } finally {
      if (original !== undefined) {
        process.env.CHAT_STORAGE_DIR = original;
      }
    }
  });
});

describe("DEFAULT_PROJECT", () => {
  it("is 'general'", () => {
    expect(DEFAULT_PROJECT).toBe("general");
  });
});
