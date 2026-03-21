import { listChats } from "../store/chat-store.ts";
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

async function main(): Promise<void> {
  const project = process.argv[2];
  const storageRoot = resolveStorageRoot();

  if (project) {
    // List chats for a specific project
    const chats = await listChats(storageRoot, project);
    if (chats.length === 0) {
      console.log(`No chats found in project "${project}".`);
      console.log("Use /chat to start a new conversation.");
      return;
    }

    console.log(`Recent chats in "${project}":`);
    console.log();
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i]!;
      const relDate = formatRelativeDate(chat.lastModified);
      console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
    }
    console.log();
    return;
  }

  // No project specified -- list all projects
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
    const chats = await listChats(storageRoot, proj);
    if (chats.length === 0) continue;

    totalChats += chats.length;
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

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
