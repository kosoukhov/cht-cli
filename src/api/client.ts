import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { DEFAULT_MODEL } from "../markdown/format.ts";

let _client: Anthropic | undefined;

export type StreamResult = {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
};

export function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey:
        process.env.ANTHROPIC_API_KEY ||
        process.env.ANTHROPIC_AUTH_TOKEN ||
        undefined,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      timeout: 120_000,
    });
  }
  return _client;
}

export async function sendAndStream(
  messages: MessageParam[],
  systemPrompt?: string,
  model?: string,
): Promise<StreamResult> {
  const client = getClient();

  const stream = client.messages.stream({
    model: model || DEFAULT_MODEL,
    max_tokens: 8192,
    messages,
    ...(systemPrompt ? { system: systemPrompt } : {}),
  });

  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  try {
    const finalMessage = await stream.finalMessage();
    process.stdout.write("\n\n");

    const textBlocks = finalMessage.content.filter(
      (block) => block.type === "text",
    );
    return {
      text: textBlocks.map((block) => block.text).join(""),
      usage: {
        input_tokens: finalMessage.usage?.input_tokens ?? 0,
        output_tokens: finalMessage.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    process.stdout.write("\n");
    throw error;
  }
}
