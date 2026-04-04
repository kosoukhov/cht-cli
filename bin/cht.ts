#!/usr/bin/env node --experimental-strip-types
import {
  createChat,
  readChat,
  listChats,
  deleteChat,
  archiveChat,
  restoreChat,
  listArchivedChats,
  appendMessage,
  appendCompactMarker,
  updateFrontmatter,
} from "../src/store/chat-store.ts";
import { searchChats } from "../src/search/search.ts";
import { listProjects } from "../src/store/project-store.ts";
import { resolveStorageRoot } from "../src/utils/paths.ts";
import {
  getActiveChat,
  setActiveChat,
  clearActiveChat,
  clearIfMatches,
} from "../src/session/state.ts";
import { normalizeTag } from "../src/tags/normalize.ts";
import {
  readStdinJson,
  UserPromptInput,
  StopInput,
  PostCompactInput,
  SessionEndInput,
} from "../src/hooks/stdin.ts";
import { registerHooks, cleanProjectHooks } from "../src/hooks/setup.ts";
import fs from "node:fs/promises";
import path from "node:path";
import type { ChatListEntry } from "../src/types.ts";
import type { SearchResult } from "../src/search/search.ts";

const [command, ...args] = process.argv.slice(2);

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  const next = args[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

/** Get non-flag arguments (arguments that don't start with -- and aren't flag values) */
function getNonFlagArgs(): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      // Skip flag and its value if present
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        i++;
      }
      continue;
    }
    result.push(arg);
  }
  return result;
}

function serializeEntry(entry: ChatListEntry) {
  return { ...entry, lastModified: entry.lastModified.toISOString() };
}

function serializeSearchResult(result: SearchResult) {
  return { ...result, lastModified: result.lastModified.toISOString() };
}

function output(data: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(data) + "\n");
}

async function hookErrorHandler(hookName: string, err: unknown): Promise<never> {
  try {
    const logPath = path.join(resolveStorageRoot(), ".hook-errors.log");
    const message = err instanceof Error ? err.message : String(err);
    const entry = `[${new Date().toISOString()}] ${hookName}: ${message}\n`;
    await fs.appendFile(logPath, entry);
  } catch {
    // If even logging fails, silently give up
  }
  process.exit(1);
}

async function main(): Promise<void> {
  const storageRoot = resolveStorageRoot();

  switch (command) {
    case "create": {
      const project = args[0] || "general";
      const title = args[1] || "(untitled)";
      const chatPath = await createChat(storageRoot, project, title);
      output({ ok: true, chat_path: chatPath });
      break;
    }

    case "list": {
      const nonFlagArgs = getNonFlagArgs();
      const project = nonFlagArgs[0] || "general";
      const archived = hasFlag("--archived");
      const recentStr = parseFlag("--recent");
      const tag = parseFlag("--tag");

      let entries: ChatListEntry[];
      if (archived) {
        entries = await listArchivedChats(storageRoot, project);
      } else {
        entries = await listChats(storageRoot, project);
      }

      if (tag) {
        entries = entries.filter((e) => e.tags.includes(tag));
      }

      if (recentStr) {
        const n = parseInt(recentStr, 10);
        if (!isNaN(n) && n > 0) {
          entries = entries.slice(0, n);
        }
      }

      output({ ok: true, chats: entries.map(serializeEntry) });
      break;
    }

    case "search": {
      const nonFlagArgs = getNonFlagArgs();
      const allProjects = hasFlag("--all");

      let project: string;
      let query: string;

      if (nonFlagArgs.length >= 2) {
        project = nonFlagArgs[0]!;
        query = nonFlagArgs.slice(1).join(" ");
      } else if (nonFlagArgs.length === 1) {
        project = "general";
        query = nonFlagArgs[0]!;
      } else {
        output({ ok: false, error: "Usage: search [project] <query> [--all]" });
        process.exit(1);
        return;
      }

      const results = await searchChats(
        storageRoot,
        query,
        allProjects ? undefined : project,
        allProjects,
      );
      output({ ok: true, results: results.map(serializeSearchResult) });
      break;
    }

    case "read": {
      const chatPath = args[0];
      if (!chatPath) {
        output({ ok: false, error: "Usage: read <path>" });
        process.exit(1);
        return;
      }
      const chat = await readChat(chatPath);
      output({ ok: true, chat });
      break;
    }

    case "delete": {
      const chatPath = args[0];
      if (!chatPath) {
        output({ ok: false, error: "Usage: delete <path>" });
        process.exit(1);
        return;
      }
      await clearIfMatches(chatPath);
      await deleteChat(chatPath);
      output({ ok: true, deleted: chatPath });
      break;
    }

    case "archive": {
      const chatPath = args[0];
      const project = args[1];
      if (!chatPath || !project) {
        output({ ok: false, error: "Usage: archive <path> <project>" });
        process.exit(1);
        return;
      }
      await clearIfMatches(chatPath);
      const archivedPath = await archiveChat(chatPath, storageRoot, project);
      output({ ok: true, archived: archivedPath });
      break;
    }

    case "restore": {
      const chatPath = args[0];
      const project = args[1];
      if (!chatPath || !project) {
        output({ ok: false, error: "Usage: restore <path> <project>" });
        process.exit(1);
        return;
      }
      const restoredPath = await restoreChat(chatPath, storageRoot, project);
      output({ ok: true, restored: restoredPath });
      break;
    }

    case "session-get": {
      const active = await getActiveChat();
      output({ ok: true, active });
      break;
    }

    case "session-set": {
      const chatPath = args[0];
      const project = args[1];
      if (!chatPath || !project) {
        output({ ok: false, error: "Usage: session-set <chat_path> <project>" });
        process.exit(1);
        return;
      }
      await setActiveChat({ chat_path: chatPath, project });
      output({ ok: true });
      break;
    }

    case "session-clear": {
      await clearActiveChat();
      output({ ok: true });
      break;
    }

    case "projects": {
      const projects = await listProjects(storageRoot);
      output({ ok: true, projects });
      break;
    }

    case "append": {
      const role = args[0] as "user" | "assistant";
      if (!role || (role !== "user" && role !== "assistant")) {
        output({ ok: false, error: "Usage: append <user|assistant> -- content on stdin" });
        process.exit(1);
        return;
      }
      // Read content from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString("utf-8").trim();
      if (!content) {
        output({ ok: false, error: "No content provided on stdin" });
        process.exit(1);
        return;
      }
      const active = await getActiveChat();
      if (!active) {
        output({ ok: false, error: "No active chat session" });
        process.exit(1);
        return;
      }
      await appendMessage(active.chat_path, role, content);
      output({ ok: true, role, chat_path: active.chat_path });
      break;
    }

    case "rename": {
      const chatPath = args[0];
      const newTitle = args.slice(1).join(" ");
      if (!chatPath || !newTitle) {
        output({ ok: false, error: "Usage: rename <path> <new-title>" });
        process.exit(1);
        return;
      }
      await updateFrontmatter(chatPath, { title: newTitle });
      output({ ok: true, renamed: chatPath, title: newTitle });
      break;
    }

    case "tag-add": {
      const chatPath = args[0];
      const rawTag = args[1];
      if (!chatPath || !rawTag) {
        output({ ok: false, error: "Usage: tag-add <path> <tag>" });
        process.exit(1);
        return;
      }
      const tag = normalizeTag(rawTag);
      if (!tag) {
        output({ ok: false, error: `Invalid tag: "${rawTag}" normalizes to empty` });
        process.exit(1);
        return;
      }
      const chat = await readChat(chatPath);
      const currentTags = chat.frontmatter.tags || [];
      if (currentTags.includes(tag)) {
        output({ ok: true, tag, tags: currentTags });
        break;
      }
      const newTags = [...currentTags, tag];
      await updateFrontmatter(chatPath, { tags: newTags });
      output({ ok: true, tag, tags: newTags });
      break;
    }

    case "tag-remove": {
      const chatPath = args[0];
      const rawTag = args[1];
      if (!chatPath || !rawTag) {
        output({ ok: false, error: "Usage: tag-remove <path> <tag>" });
        process.exit(1);
        return;
      }
      const tag = normalizeTag(rawTag);
      if (!tag) {
        output({ ok: false, error: `Invalid tag: "${rawTag}" normalizes to empty` });
        process.exit(1);
        return;
      }
      const chat = await readChat(chatPath);
      const currentTags = chat.frontmatter.tags || [];
      if (!currentTags.includes(tag)) {
        output({ ok: true, tag, tags: currentTags });
        break;
      }
      const newTags = currentTags.filter((t: string) => t !== tag);
      await updateFrontmatter(chatPath, { tags: newTags });
      output({ ok: true, tag, tags: newTags });
      break;
    }

    case "status": {
      const active = await getActiveChat();
      if (!active) {
        output({ ok: false, error: "No active chat session. Start one with /cht:new or /cht:continue." });
        process.exit(1);
        return;
      }

      let stat: import("node:fs").Stats;
      let chat: import("../src/types.ts").ParsedChat;
      try {
        stat = await fs.stat(active.chat_path);
        chat = await readChat(active.chat_path);
      } catch {
        output({ ok: false, error: "Active chat file not found. It may have been deleted or archived." });
        process.exit(1);
        return;
      }

      const messageCount = chat.messages.length;
      const compactCount = chat.compactMarkers.length;
      const fileSizeBytes = stat.size;
      const estimatedTokens = Math.round(fileSizeBytes / 4);

      const MESSAGE_THRESHOLD = 50;
      const SIZE_THRESHOLD = 102400; // 100 KB

      const isLarge = messageCount >= MESSAGE_THRESHOLD || fileSizeBytes >= SIZE_THRESHOLD;
      let warning: string | null = null;
      if (isLarge && compactCount > 0) {
        warning = `Chat has been compacted ${compactCount} time(s). Consider /cht:rollover to start fresh with context.`;
      } else if (isLarge) {
        warning = "Chat is getting large. Run /cht:rollover to continue in a new file with context linked.";
      }

      // Resolve chain links for rollover navigation (D-08)
      const chainInfo: Record<string, unknown> = {};
      if (chat.frontmatter.continued_from) {
        try {
          const prevChat = await readChat(chat.frontmatter.continued_from);
          chainInfo.continued_from = {
            path: chat.frontmatter.continued_from,
            title: prevChat.frontmatter.title,
          };
        } catch {
          chainInfo.continued_from = {
            path: chat.frontmatter.continued_from,
            title: "(file not found)",
          };
        }
      }
      if (chat.frontmatter.continued_in) {
        try {
          const nextChat = await readChat(chat.frontmatter.continued_in);
          chainInfo.continued_in = {
            path: chat.frontmatter.continued_in,
            title: nextChat.frontmatter.title,
          };
        } catch {
          chainInfo.continued_in = {
            path: chat.frontmatter.continued_in,
            title: "(file not found)",
          };
        }
      }

      output({
        ok: true,
        chat_path: active.chat_path,
        title: chat.frontmatter.title,
        project: chat.frontmatter.project,
        message_count: messageCount,
        compact_count: compactCount,
        file_size_bytes: fileSizeBytes,
        estimated_tokens: estimatedTokens,
        warning,
        chain: Object.keys(chainInfo).length > 0 ? chainInfo : null,
      });
      break;
    }

    case "rollover": {
      // 1. Verify active session exists
      const active = await getActiveChat();
      if (!active) {
        output({ ok: false, error: "No active chat to roll over. Start one with /cht:new." });
        process.exit(1);
        return;
      }

      // 2. Read old chat to get project, title, and tags
      const oldChat = await readChat(active.chat_path);
      const project = oldChat.frontmatter.project;
      const title = oldChat.frontmatter.title;
      const tags = oldChat.frontmatter.tags;

      // 3. Create new chat file (inherits title verbatim)
      const newChatPath = await createChat(storageRoot, project, title);

      // 4. Switch session to new chat FIRST (critical invariant: always have active chat)
      await setActiveChat({ chat_path: newChatPath, project });

      // 5. Update old chat frontmatter with continued_in link (absolute path)
      await updateFrontmatter(active.chat_path, { continued_in: newChatPath });

      // 6. Update new chat frontmatter with continued_from link + copy tags
      await updateFrontmatter(newChatPath, {
        continued_from: active.chat_path,
        ...(tags && tags.length > 0 ? { tags } : {}),
      });

      output({
        ok: true,
        old_chat_path: active.chat_path,
        new_chat_path: newChatPath,
        project,
        title,
      });
      break;
    }

    case "hook-save-user": {
      try {
        const input = await readStdinJson(UserPromptInput);
        const active = await getActiveChat();
        if (!active) {
          process.exit(0);
        }
        const content = input.prompt;
        if (!content || content.trim() === "") {
          process.exit(0);
        }
        const chat = await readChat(active.chat_path);
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg && lastMsg.role === "user" && lastMsg.content === content) {
          process.exit(0);
        }
        await appendMessage(active.chat_path, "user", content);
        process.exit(0);
      } catch (err) {
        await hookErrorHandler("hook-save-user", err);
      }
      break;
    }

    case "hook-save-assistant": {
      try {
        const input = await readStdinJson(StopInput);
        const content = input.last_assistant_message;
        if (!content || content.trim() === "") {
          process.exit(0);
        }
        const active = await getActiveChat();
        if (!active) {
          process.exit(0);
        }
        const chat = await readChat(active.chat_path);
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.content === content) {
          process.exit(0);
        }
        await appendMessage(active.chat_path, "assistant", content);
        process.exit(0);
      } catch (err) {
        await hookErrorHandler("hook-save-assistant", err);
      }
      break;
    }

    case "hook-save-compact": {
      try {
        const input = await readStdinJson(PostCompactInput);
        const active = await getActiveChat();
        if (!active) {
          process.exit(0);
        }
        await appendCompactMarker(active.chat_path, input.trigger);
        process.exit(0);
      } catch (err) {
        await hookErrorHandler("hook-save-compact", err);
      }
      break;
    }

    case "hook-session-clear": {
      try {
        await readStdinJson(SessionEndInput);
        await clearActiveChat();
        process.exit(0);
      } catch (err) {
        await hookErrorHandler("hook-session-clear", err);
      }
      break;
    }

    case "setup": {
      const result = await registerHooks();
      const cleanup = await cleanProjectHooks();
      output({
        ok: true,
        hooks_added: result.added,
        hooks_skipped: result.skipped,
        files_deleted: cleanup.deleted,
        settings_cleaned: cleanup.cleaned,
      });
      break;
    }

    default: {
      output({
        ok: false,
        error: `Unknown command: ${command ?? "(none)"}. Available: create, list, search, read, delete, archive, restore, append, rename, tag-add, tag-remove, session-get, session-set, session-clear, projects, status, rollover, hook-save-user, hook-save-assistant, hook-save-compact, hook-session-clear, setup`,
      });
      process.exit(1);
    }
  }
}

main().catch((err: Error) => {
  output({ ok: false, error: err.message });
  process.exit(1);
});
