import { z } from "zod/v4";

// Chat frontmatter -- stored as YAML at top of every .md chat file
export const ChatFrontmatterSchema = z.object({
  title: z.string(),
  project: z.string(),
  created: z.iso.datetime(),
  model: z.string(),
  system_prompt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  continued_from: z.string().optional(),
  continued_in: z.string().optional(),
});
export type ChatFrontmatter = z.infer<typeof ChatFrontmatterSchema>;

// Single chat message -- parsed from ## User / ## Assistant sections
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Full parsed chat -- frontmatter + messages
export type ParsedChat = {
  frontmatter: ChatFrontmatter;
  messages: ChatMessage[];
};

// Project-level config -- stored as _config.yaml in project directory
export const ProjectConfigSchema = z.object({
  system_prompt: z.string().optional(),
  model: z.string().optional(),
  context_window: z.number().optional(),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Chat list entry -- returned by listChats()
export type ChatListEntry = {
  path: string;
  title: string;
  project: string;
  created: string;
  lastModified: Date;
  preview: string;
  tags: string[];
};
