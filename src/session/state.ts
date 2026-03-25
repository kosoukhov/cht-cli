import { z } from "zod/v4";
import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "../store/atomic-write.ts";
import { resolveStorageRoot } from "../utils/paths.ts";

export const ActiveChatSchema = z.object({
  chat_path: z.string(),
  project: z.string(),
});
export type ActiveChat = z.infer<typeof ActiveChatSchema>;

const STATE_FILENAME = ".active-chat.json";

function statePath(): string {
  return path.join(resolveStorageRoot(), STATE_FILENAME);
}

export async function getActiveChat(): Promise<ActiveChat | null> {
  try {
    const raw = await fs.readFile(statePath(), "utf-8");
    const parsed = ActiveChatSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function setActiveChat(state: ActiveChat): Promise<void> {
  const dir = resolveStorageRoot();
  await fs.mkdir(dir, { recursive: true });
  await writeFileAtomic(statePath(), JSON.stringify(state, null, 2) + "\n");
}

export async function clearActiveChat(): Promise<void> {
  try {
    await fs.unlink(statePath());
  } catch {
    // Ignore -- file may not exist
  }
}

export async function clearIfMatches(chatPath: string): Promise<void> {
  const active = await getActiveChat();
  if (active && active.chat_path === chatPath) {
    await clearActiveChat();
  }
}
