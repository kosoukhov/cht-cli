import { getActiveChat } from "../../src/session/state.ts";
import { appendMessage, readChat } from "../../src/store/chat-store.ts";
import { resolveStorageRoot } from "../../src/utils/paths.ts";
import fs from "node:fs/promises";
import path from "node:path";

interface StopHookInput {
  session_id: string;
  hook_event_name: string;
  stop_hook_active: boolean;
  last_assistant_message: string | null;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input: StopHookInput = JSON.parse(
    Buffer.concat(chunks).toString("utf-8"),
  );

  // D-02: Skip if no text content (pure tool-call responses)
  const content = input.last_assistant_message;
  if (!content || content.trim() === "") {
    process.exit(0);
  }

  // D-04: Only save when session is active
  const active = await getActiveChat();
  if (!active) {
    process.exit(0);
  }

  // D-03: Deduplication -- check last message
  const chat = await readChat(active.chat_path);
  const lastMsg = chat.messages[chat.messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant" && lastMsg.content === content) {
    process.exit(0);
  }

  await appendMessage(active.chat_path, "assistant", content);
  process.exit(0);
}

main().catch(async (err: Error) => {
  // D-07: Silent failure with log
  try {
    const logPath = path.join(resolveStorageRoot(), ".hook-errors.log");
    const entry = `[${new Date().toISOString()}] save-assistant-message: ${err.message}\n`;
    await fs.appendFile(logPath, entry);
  } catch {
    // If even logging fails, silently give up
  }
  process.exit(1);
});
