import { describe, it, expect } from "vitest";
import { parseRecentFlag, parseFlags, parseTagFlag } from "../../src/commands/list-chats.ts";

describe("list-chats flags", () => {
  describe("parseRecentFlag", () => {
    it("returns N when --recent N provided", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent", "5"])).toBe(5);
    });

    it("returns 10 when --recent has no number (D-13 default)", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent"])).toBe(10);
    });

    it("returns undefined when --recent not present", () => {
      expect(parseRecentFlag(["node", "script", "proj"])).toBeUndefined();
    });

    it("returns 10 for NaN value", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent", "abc"])).toBe(10);
    });

    it("returns 10 for zero", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent", "0"])).toBe(10);
    });

    it("returns 10 for negative value", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent", "-1"])).toBe(10);
    });

    it("returns 10 when next arg is another flag", () => {
      expect(parseRecentFlag(["node", "script", "proj", "--recent", "--archived"])).toBe(10);
    });
  });

  describe("parseTagFlag", () => {
    it("returns tag value when --tag followed by value", () => {
      expect(parseTagFlag(["node", "script", "proj", "--tag", "work"])).toBe("work");
    });
    it("returns undefined when --tag not present", () => {
      expect(parseTagFlag(["node", "script", "proj"])).toBeUndefined();
    });
    it("returns undefined when --tag has no value", () => {
      expect(parseTagFlag(["node", "script", "proj", "--tag"])).toBeUndefined();
    });
    it("returns undefined when next arg is a flag", () => {
      expect(parseTagFlag(["node", "script", "proj", "--tag", "--recent"])).toBeUndefined();
    });
  });

  describe("parseFlags", () => {
    it("extracts project from argv[2] when no flags", () => {
      const flags = parseFlags(["node", "script", "myproject"]);
      expect(flags.project).toBe("myproject");
      expect(flags.recent).toBeUndefined();
      expect(flags.archived).toBe(false);
      expect(flags.delete_).toBe(false);
      expect(flags.archive).toBe(false);
      expect(flags.restore).toBe(false);
    });

    it("detects --archived flag", () => {
      const flags = parseFlags(["node", "script", "myproject", "--archived"]);
      expect(flags.archived).toBe(true);
    });

    it("detects --delete flag", () => {
      const flags = parseFlags(["node", "script", "myproject", "--delete"]);
      expect(flags.delete_).toBe(true);
    });

    it("detects --archive flag", () => {
      const flags = parseFlags(["node", "script", "myproject", "--archive"]);
      expect(flags.archive).toBe(true);
    });

    it("detects --restore flag", () => {
      const flags = parseFlags(["node", "script", "myproject", "--restore"]);
      expect(flags.restore).toBe(true);
    });

    it("detects --recent with value", () => {
      const flags = parseFlags(["node", "script", "myproject", "--recent", "5"]);
      expect(flags.recent).toBe(5);
    });

    it("handles no project argument", () => {
      const flags = parseFlags(["node", "script"]);
      expect(flags.project).toBeUndefined();
    });

    it("handles --archived and --archive together correctly", () => {
      const flags = parseFlags(["node", "script", "myproject", "--archived", "--archive"]);
      expect(flags.archived).toBe(true);
      expect(flags.archive).toBe(true);
    });

    it("detects --tag flag with value", () => {
      const flags = parseFlags(["node", "script", "myproject", "--tag", "work"]);
      expect(flags.tag).toBe("work");
    });

    it("has undefined tag when --tag not provided", () => {
      const flags = parseFlags(["node", "script", "myproject"]);
      expect(flags.tag).toBeUndefined();
    });
  });
});
