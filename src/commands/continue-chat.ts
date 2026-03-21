import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { listChats } from "../store/chat-store.ts";
import { resolveStorageRoot, DEFAULT_PROJECT } from "../utils/paths.ts";
import { runRepl } from "../repl/repl.ts";

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
  const project = process.argv[2] || DEFAULT_PROJECT;
  const storageRoot = resolveStorageRoot();

  const chats = await listChats(storageRoot, project);

  if (chats.length === 0) {
    console.log(`No chats found in project "${project}".`);
    console.log("Use /chat to start a new conversation.");
    return;
  }

  // Display max 20 chats per UI-SPEC
  const displayChats = chats.slice(0, 20);

  console.log(`Recent chats in "${project}":`);
  console.log();
  for (let i = 0; i < displayChats.length; i++) {
    const chat = displayChats[i]!;
    const relDate = formatRelativeDate(chat.lastModified);
    console.log(`  ${i + 1}. ${chat.title}  (${relDate})`);
  }
  console.log();

  // Prompt for selection
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("Enter number to continue, or q to cancel: ");

    if (answer.trim().toLowerCase() === "q") return;

    const num = parseInt(answer.trim(), 10);
    if (isNaN(num) || num < 1 || num > displayChats.length) {
      console.log("Invalid selection.");
      return;
    }

    const selectedChat = displayChats[num - 1]!;
    rl.close();

    await runRepl(selectedChat.path, storageRoot);
  } catch {
    // readline closed
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
