import {
  createChat,
  readChat,
  listChats,
  deleteChat,
  archiveChat,
  restoreChat,
  listArchivedChats,
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
        query = nonFlagArgs[1]!;
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

    default: {
      output({
        ok: false,
        error: `Unknown command: ${command ?? "(none)"}. Available: create, list, search, read, delete, archive, restore, session-get, session-set, session-clear, projects`,
      });
      process.exit(1);
    }
  }
}

main().catch((err: Error) => {
  output({ ok: false, error: err.message });
  process.exit(1);
});
