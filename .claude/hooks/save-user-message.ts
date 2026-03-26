import { getActiveChat } from "../../src/session/state.ts";
import { appendMessage, readChat } from "../../src/store/chat-store.ts";
import { resolveStorageRoot } from "../../src/utils/paths.ts";
import fs from "node:fs/promises";
import path from "node:path";

interface UserPromptSubmitInput {
  session_id: string;
  hook_event_name: string;
  prompt: string;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input: UserPromptSubmitInput = JSON.parse(
    Buffer.concat(chunks).toString("utf-8"),
  );

  // D-04: Only save when session is active
  const active = await getActiveChat();
  if (!active) {
    process.exit(0);
  }

  const content = input.prompt;
  if (!content || content.trim() === "") {
    process.exit(0);
  }

  // D-03: Deduplication -- check last message
  const chat = await readChat(active.chat_path);
  const lastMsg = chat.messages[chat.messages.length - 1];
  if (lastMsg && lastMsg.role === "user" && lastMsg.content === content) {
    process.exit(0);
  }

  await appendMessage(active.chat_path, "user", content);
  process.exit(0);
}

main().catch(async (err: Error) => {
  // D-07: Silent failure with log
  try {
    const logPath = path.join(resolveStorageRoot(), ".hook-errors.log");
    const entry = `[${new Date().toISOString()}] save-user-message: ${err.message}\n`;
    await fs.appendFile(logPath, entry);
  } catch {
    // If even logging fails, silently give up
  }
  process.exit(1);
});
