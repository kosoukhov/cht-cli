import { getClient } from "./client.ts";

const TITLE_MODEL = "claude-haiku-4-5-20250929";

export async function generateChatTitle(
  userMessage: string,
  assistantResponse: string,
): Promise<string> {
  try {
    const client = getClient();

    const response = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Generate a short title (3-7 words) for a chat that starts with this exchange. Return ONLY the title, no quotes, no explanation.\n\nUser: ${userMessage.slice(0, 500)}\nAssistant: ${assistantResponse.slice(0, 500)}`,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === "text") {
      return text.text.trim();
    }
    return "Untitled Chat";
  } catch {
    return "Untitled Chat";
  }
}
