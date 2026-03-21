import { createChat } from "../store/chat-store.ts";
import { resolveStorageRoot, DEFAULT_PROJECT } from "../utils/paths.ts";
import { runRepl } from "../repl/repl.ts";

async function main(): Promise<void> {
  const project = process.argv[2] || DEFAULT_PROJECT;
  const storageRoot = resolveStorageRoot();

  const chatPath = await createChat(storageRoot, project, "(untitled)");
  await runRepl(chatPath, storageRoot);
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
