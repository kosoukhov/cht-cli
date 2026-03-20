// Stub -- to be implemented in GREEN phase
import type { ParsedChat, ChatListEntry } from "../types.ts";

export async function createChat(
  _storageRoot: string,
  _project: string,
  _title: string,
  _options?: { model?: string; systemPrompt?: string },
): Promise<string> {
  throw new Error("Not implemented");
}

export async function readChat(_filePath: string): Promise<ParsedChat> {
  throw new Error("Not implemented");
}

export async function listChats(
  _storageRoot: string,
  _project: string,
): Promise<ChatListEntry[]> {
  throw new Error("Not implemented");
}

export async function appendMessage(
  _filePath: string,
  _role: "user" | "assistant",
  _content: string,
): Promise<void> {
  throw new Error("Not implemented");
}
