import { getActiveChat } from "../../src/session/state.ts";
import { appendCompactMarker } from "../../src/store/chat-store.ts";
import { resolveStorageRoot } from "../../src/utils/paths.ts";
import fs from "node:fs/promises";
import path from "node:path";

interface PostCompactInput {
  session_id: string;
  hook_event_name: string;
  trigger: "auto" | "manual";
  compact_summary?: string; // Received but discarded (per D-02)
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input: PostCompactInput = JSON.parse(
    Buffer.concat(chunks).toString("utf-8"),
  );

  const active = await getActiveChat();
  if (!active) {
    process.exit(0); // No active chat -- silent exit
  }

  await appendCompactMarker(active.chat_path, input.trigger);
  process.exit(0);
}

main().catch(async (err: Error) => {
  try {
    const logPath = path.join(resolveStorageRoot(), ".hook-errors.log");
    const entry = `[${new Date().toISOString()}] save-compact-marker: ${err.message}\n`;
    await fs.appendFile(logPath, entry);
  } catch {
    // Silent failure
  }
  process.exit(1);
});
