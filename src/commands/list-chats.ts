import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  listChats,
  listArchivedChats,
  readChat,
  deleteChat,
  archiveChat,
  restoreChat,
} from "../store/chat-store.ts";
import { listProjects } from "../store/project-store.ts";
import { resolveStorageRoot } from "../utils/paths.ts";

/**
 * Format a date as a relative string per UI-SPEC:
 * - 0 days: "today"
 * - 1 day: "yesterday"
 * - 2-7 days: "{n} days ago"
 * - >7 days: YYYY-MM-DD
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return `${diffDays} days ago`;
  return date.toISOString().slice(0, 10);
}

// --- Flag parsing utilities (exported for testing) ---

export function parseRecentFlag(argv: string[]): number | undefined {
  const idx = argv.indexOf("--recent");
  if (idx === -1) return undefined;
  const val = argv[idx + 1];
  if (!val || val.startsWith("--")) return 10; // D-13: default 10
  const n = parseInt(val, 10);
  return isNaN(n) || n < 1 ? 10 : n;
}

export type ListChatsFlags = {
  project: string | undefined;
  recent: number | undefined;
  archived: boolean;
  delete_: boolean;
  archive: boolean;
  restore: boolean;
};

export function parseFlags(argv: string[]): ListChatsFlags {
  // Project is the first non-flag argument after script path
  const args = argv.slice(2);
  const project = args.find((a) => !a.startsWith("--"));
  return {
    project,
    recent: parseRecentFlag(argv),
    archived: argv.includes("--archived"),
    delete_: argv.includes("--delete"),
    archive: argv.includes("--archive"),
    restore: argv.includes("--restore"),
  };
}

// --- Interactive helpers ---

async function interactiveDelete(
  storageRoot: string,
  project: string,
): Promise<void> {
  const chats = await listChats(storageRoot, project);
  if (chats.length === 0) {
    console.log(`No chats found in project "${project}".`);
    return;
  }
  console.log("Select a chat to delete:\n");
  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i]!;
    const relDate = formatRelativeDate(chat.lastModified);
    console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
  }
  console.log();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      "Enter number to delete, or q to cancel: ",
    );
    if (answer.trim().toLowerCase() === "q" || answer.trim() === "") return;
    const num = parseInt(answer.trim(), 10);
    if (isNaN(num) || num < 1 || num > chats.length) {
      console.log("Invalid selection.");
      return;
    }
    const selected = chats[num - 1]!;
    // Read full chat for message count
    const fullChat = await readChat(selected.path);
    const count = fullChat.messages.length;
    const title = fullChat.frontmatter.title || "(untitled)";
    console.log(`Delete "${title}" (${count} messages)?`);
    const confirm = await rl.question("This cannot be undone. [y/N] ");
    if (confirm.trim().toLowerCase() === "y") {
      await deleteChat(selected.path);
      console.log(`Deleted: ${title}`);
    } else {
      console.log("Delete cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function interactiveArchive(
  storageRoot: string,
  project: string,
): Promise<void> {
  const chats = await listChats(storageRoot, project);
  if (chats.length === 0) {
    console.log(`No chats found in project "${project}".`);
    return;
  }
  console.log("Select a chat to archive:\n");
  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i]!;
    const relDate = formatRelativeDate(chat.lastModified);
    console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
  }
  console.log();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      "Enter number to archive, or q to cancel: ",
    );
    if (answer.trim().toLowerCase() === "q" || answer.trim() === "") return;
    const num = parseInt(answer.trim(), 10);
    if (isNaN(num) || num < 1 || num > chats.length) {
      console.log("Invalid selection.");
      return;
    }
    const selected = chats[num - 1]!;
    const fullChat = await readChat(selected.path);
    const count = fullChat.messages.length;
    const title = fullChat.frontmatter.title || "(untitled)";
    console.log(`Archive "${title}" (${count} messages)?`);
    const confirm = await rl.question(
      "Chat will be hidden from listings but preserved on disk. [y/N] ",
    );
    if (confirm.trim().toLowerCase() === "y") {
      await archiveChat(selected.path, storageRoot, project);
      console.log(`Archived: ${title}`);
    } else {
      console.log("Archive cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function interactiveRestore(
  storageRoot: string,
  project: string,
): Promise<void> {
  const chats = await listArchivedChats(storageRoot, project);
  if (chats.length === 0) {
    console.log(`No archived chats in "${project}".`);
    return;
  }
  console.log("Select a chat to restore:\n");
  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i]!;
    const relDate = formatRelativeDate(chat.lastModified);
    console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
  }
  console.log();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      "Enter number to restore, or q to cancel: ",
    );
    if (answer.trim().toLowerCase() === "q" || answer.trim() === "") return;
    const num = parseInt(answer.trim(), 10);
    if (isNaN(num) || num < 1 || num > chats.length) {
      console.log("Invalid selection.");
      return;
    }
    const selected = chats[num - 1]!;
    const title = selected.title || "(untitled)";
    await restoreChat(selected.path, storageRoot, project);
    console.log(`Restored: ${title}`);
  } finally {
    rl.close();
  }
}

// --- List helpers ---

async function listAllProjects(
  storageRoot: string,
  recent: number | undefined,
): Promise<void> {
  let projects: string[];
  try {
    projects = await listProjects(storageRoot);
  } catch {
    projects = [];
  }
  if (projects.length === 0) {
    console.log("No chats found.");
    console.log("Use /chat to start a new conversation.");
    return;
  }
  let totalChats = 0;
  for (const proj of projects) {
    let chats = await listChats(storageRoot, proj);
    if (chats.length === 0) continue;
    totalChats += chats.length;
    if (recent !== undefined) {
      chats = chats.slice(0, recent);
    }
    console.log(`Recent chats in "${proj}":`);
    console.log();
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i]!;
      const relDate = formatRelativeDate(chat.lastModified);
      console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
    }
    console.log();
  }
  if (totalChats === 0) {
    console.log("No chats found.");
    console.log("Use /chat to start a new conversation.");
  }
}

// --- Main ---

async function main(): Promise<void> {
  const flags = parseFlags(process.argv);
  const storageRoot = resolveStorageRoot();

  // Validate flag combinations per UI-SPEC
  if (flags.delete_ && flags.archive) {
    console.error("Error: Cannot use --delete and --archive together.");
    process.exit(1);
  }
  if (flags.restore && !flags.archived) {
    console.error("Error: --restore requires --archived flag.");
    process.exit(1);
  }

  // If no project, list all projects (existing behavior)
  if (!flags.project) {
    await listAllProjects(storageRoot, flags.recent);
    return;
  }

  const project = flags.project;

  // Interactive restore from archive
  if (flags.archived && flags.restore) {
    await interactiveRestore(storageRoot, project);
    return;
  }

  // List archived chats
  if (flags.archived) {
    const chats = await listArchivedChats(storageRoot, project);
    if (chats.length === 0) {
      console.log(`No archived chats in "${project}".`);
      return;
    }
    let display = chats;
    if (flags.recent !== undefined) {
      display = chats.slice(0, flags.recent);
    }
    console.log(`Archived chats in "${project}":`);
    console.log();
    for (let i = 0; i < display.length; i++) {
      const chat = display[i]!;
      const relDate = formatRelativeDate(chat.lastModified);
      console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
    }
    console.log();
    return;
  }

  // Interactive delete
  if (flags.delete_) {
    await interactiveDelete(storageRoot, project);
    return;
  }

  // Interactive archive
  if (flags.archive) {
    await interactiveArchive(storageRoot, project);
    return;
  }

  // Default: list active chats (with optional --recent N)
  const chats = await listChats(storageRoot, project);
  if (chats.length === 0) {
    console.log(`No chats found in project "${project}".`);
    console.log("Use /chat to start a new conversation.");
    return;
  }
  let display = chats;
  if (flags.recent !== undefined) {
    display = chats.slice(0, flags.recent);
  }
  console.log(`Recent chats in "${project}":`);
  console.log();
  for (let i = 0; i < display.length; i++) {
    const chat = display[i]!;
    const relDate = formatRelativeDate(chat.lastModified);
    console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
