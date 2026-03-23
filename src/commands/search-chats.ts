import { searchChats, formatSearchResults } from "../search/search.ts";
import { resolveStorageRoot, DEFAULT_PROJECT } from "../utils/paths.ts";

async function main(): Promise<void> {
  // Parse: search-chats.ts <query> [--all] [project]
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: search-chats <query> [--all] [project]");
    process.exit(1);
  }

  const allFlag = args.includes("--all");
  const nonFlagArgs = args.filter((a) => a !== "--all");
  const query = nonFlagArgs[0] || "";
  const project = nonFlagArgs[1] || DEFAULT_PROJECT;

  if (!query) {
    console.log("Usage: search-chats <query> [--all] [project]");
    process.exit(1);
  }

  const storageRoot = resolveStorageRoot();
  const results = await searchChats(
    storageRoot,
    query,
    allFlag ? undefined : project,
    allFlag,
  );
  const { formatted } = formatSearchResults(results, query);
  console.log(formatted);
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
