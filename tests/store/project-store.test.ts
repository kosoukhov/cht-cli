import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  readProjectConfig,
  writeProjectConfig,
  resolveSystemPrompt,
  listProjects,
} from "../../src/store/project-store.ts";
import type { ChatFrontmatter } from "../../src/types.ts";

describe("project-store", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "project-store-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("readProjectConfig", () => {
    it("returns empty object when _config.yaml does not exist", async () => {
      // Create the project directory but no config file
      const projectDir = path.join(tmpDir, "myproject");
      await fs.mkdir(projectDir, { recursive: true });

      const config = await readProjectConfig(tmpDir, "myproject");

      expect(config).toEqual({});
    });

    it("returns parsed config when _config.yaml exists", async () => {
      const projectDir = path.join(tmpDir, "myproject");
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(
        path.join(projectDir, "_config.yaml"),
        'system_prompt: "You are a helpful assistant."\n',
        "utf-8",
      );

      const config = await readProjectConfig(tmpDir, "myproject");

      expect(config.system_prompt).toBe("You are a helpful assistant.");
    });

    it("validates with Zod and ignores unknown fields", async () => {
      const projectDir = path.join(tmpDir, "myproject");
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(
        path.join(projectDir, "_config.yaml"),
        "system_prompt: Test prompt\nunknown_field: should be ignored\nanother_junk: 42\n",
        "utf-8",
      );

      const config = await readProjectConfig(tmpDir, "myproject");

      expect(config.system_prompt).toBe("Test prompt");
      // Unknown fields should not be present
      expect((config as Record<string, unknown>).unknown_field).toBeUndefined();
      expect((config as Record<string, unknown>).another_junk).toBeUndefined();
    });

    it("returns empty object when _config.yaml has invalid content", async () => {
      const projectDir = path.join(tmpDir, "myproject");
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(
        path.join(projectDir, "_config.yaml"),
        "this is not valid yaml: [[[",
        "utf-8",
      );

      const config = await readProjectConfig(tmpDir, "myproject");

      expect(config).toEqual({});
    });
  });

  describe("writeProjectConfig", () => {
    it("creates _config.yaml with valid YAML", async () => {
      await writeProjectConfig(tmpDir, "myproject", {
        system_prompt: "You are a backend engineer.",
      });

      const configPath = path.join(tmpDir, "myproject", "_config.yaml");
      const content = await fs.readFile(configPath, "utf-8");

      expect(content).toContain("system_prompt");
      expect(content).toContain("You are a backend engineer.");
    });

    it("auto-creates project directory", async () => {
      const projectDir = path.join(tmpDir, "newproject");

      // Directory should not exist
      await expect(fs.access(projectDir)).rejects.toThrow();

      await writeProjectConfig(tmpDir, "newproject", {
        system_prompt: "test",
      });

      // Directory should now exist
      const stat = await fs.stat(projectDir);
      expect(stat.isDirectory()).toBe(true);

      // Config file should exist
      const configPath = path.join(projectDir, "_config.yaml");
      const configStat = await fs.stat(configPath);
      expect(configStat.isFile()).toBe(true);
    });

    it("writes config with model field", async () => {
      await writeProjectConfig(tmpDir, "myproject", {
        system_prompt: "Be concise.",
        model: "claude-opus-4-20250514",
      });

      const configPath = path.join(tmpDir, "myproject", "_config.yaml");
      const content = await fs.readFile(configPath, "utf-8");

      expect(content).toContain("model");
      expect(content).toContain("claude-opus-4-20250514");
    });
  });

  describe("resolveSystemPrompt", () => {
    it("returns chat-level prompt when set", async () => {
      // Set project-level prompt
      await writeProjectConfig(tmpDir, "myproject", {
        system_prompt: "Project prompt",
      });

      // Chat frontmatter with its own prompt
      const frontmatter: ChatFrontmatter = {
        title: "Test",
        project: "myproject",
        created: new Date().toISOString(),
        model: "test-model",
        system_prompt: "Chat prompt",
      };

      const resolved = await resolveSystemPrompt(
        tmpDir,
        "myproject",
        frontmatter,
      );

      expect(resolved).toBe("Chat prompt");
    });

    it("falls back to project-level prompt", async () => {
      // Set project-level prompt
      await writeProjectConfig(tmpDir, "myproject", {
        system_prompt: "Project prompt",
      });

      // Chat frontmatter without system_prompt
      const frontmatter: ChatFrontmatter = {
        title: "Test",
        project: "myproject",
        created: new Date().toISOString(),
        model: "test-model",
      };

      const resolved = await resolveSystemPrompt(
        tmpDir,
        "myproject",
        frontmatter,
      );

      expect(resolved).toBe("Project prompt");
    });

    it("returns undefined when neither is set", async () => {
      // Create project dir but no config
      const projectDir = path.join(tmpDir, "myproject");
      await fs.mkdir(projectDir, { recursive: true });

      const frontmatter: ChatFrontmatter = {
        title: "Test",
        project: "myproject",
        created: new Date().toISOString(),
        model: "test-model",
      };

      const resolved = await resolveSystemPrompt(
        tmpDir,
        "myproject",
        frontmatter,
      );

      expect(resolved).toBeUndefined();
    });
  });

  describe("listProjects", () => {
    it("returns subdirectory names", async () => {
      await fs.mkdir(path.join(tmpDir, "alpha"), { recursive: true });
      await fs.mkdir(path.join(tmpDir, "beta"), { recursive: true });
      await fs.mkdir(path.join(tmpDir, "gamma"), { recursive: true });

      const projects = await listProjects(tmpDir);

      expect(projects).toHaveLength(3);
      expect(projects).toContain("alpha");
      expect(projects).toContain("beta");
      expect(projects).toContain("gamma");
    });

    it("excludes hidden directories", async () => {
      await fs.mkdir(path.join(tmpDir, "visible"), { recursive: true });
      await fs.mkdir(path.join(tmpDir, ".hidden"), { recursive: true });

      const projects = await listProjects(tmpDir);

      expect(projects).toHaveLength(1);
      expect(projects).toContain("visible");
      expect(projects).not.toContain(".hidden");
    });

    it("excludes files (only returns directories)", async () => {
      await fs.mkdir(path.join(tmpDir, "realproject"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, "readme.md"), "hello", "utf-8");

      const projects = await listProjects(tmpDir);

      expect(projects).toHaveLength(1);
      expect(projects).toContain("realproject");
    });

    it("returns sorted array", async () => {
      await fs.mkdir(path.join(tmpDir, "charlie"), { recursive: true });
      await fs.mkdir(path.join(tmpDir, "alpha"), { recursive: true });
      await fs.mkdir(path.join(tmpDir, "bravo"), { recursive: true });

      const projects = await listProjects(tmpDir);

      expect(projects).toEqual(["alpha", "bravo", "charlie"]);
    });
  });
});
