import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createChat, listChats } from "../store/chat-store.ts";
import { resolveStorageRoot, DEFAULT_PROJECT } from "../utils/paths.ts";
import { runRepl } from "../repl/repl.ts";
import { resolveDefaultModel } from "../models/model-registry.ts";
import { readProjectConfig } from "../store/project-store.ts";

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
  const args = process.argv.slice(2);
  const includeFlag = args.includes("--include");

  // Parse --model flag and its value
  const modelFlagIdx = args.indexOf("--model");
  let flagModel: string | undefined;
  if (modelFlagIdx !== -1 && args[modelFlagIdx + 1]) {
    flagModel = args[modelFlagIdx + 1];
  }

  // Filter out all flags and their values from positional args
  const nonFlagArgs = args.filter((a, i) => {
    if (a === "--include") return false;
    if (a === "--model") return false;
    if (i > 0 && args[i - 1] === "--model") return false;
    return true;
  });
  const project = nonFlagArgs[0] || DEFAULT_PROJECT;
  const storageRoot = resolveStorageRoot();

  let initialInclude: { chatPath: string; title: string } | undefined;

  // D-01: --include flag for pre-loading context
  if (includeFlag) {
    const chats = await listChats(storageRoot, project);
    if (chats.length === 0) {
      console.log("No chats found to include.");
    } else {
      const displayChats = chats.slice(0, 20);
      console.log("Select a chat to include as context:\n");
      for (let i = 0; i < displayChats.length; i++) {
        const c = displayChats[i]!;
        const relDate = formatRelativeDate(c.lastModified);
        console.log(`  ${i + 1}. ${c.title}  (${relDate})`);
      }
      console.log();
      const rl = readline.createInterface({ input: stdin, output: stdout });
      try {
        const answer = await rl.question(
          "Enter number to include, or q to cancel: ",
        );
        const num = parseInt(answer.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= displayChats.length) {
          initialInclude = {
            chatPath: displayChats[num - 1]!.path,
            title: displayChats[num - 1]!.title,
          };
        }
      } finally {
        rl.close();
      }
    }
  }

  // Resolve model via priority chain: --model flag > project config > env var > fallback
  const projectConfig = await readProjectConfig(storageRoot, project);
  const resolvedModel = resolveDefaultModel({
    flagModel,
    configModel: projectConfig.model,
  });

  const chatPath = await createChat(storageRoot, project, "(untitled)", {
    model: resolvedModel,
  });
  await runRepl(chatPath, storageRoot, initialInclude ? { initialInclude } : undefined);
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
