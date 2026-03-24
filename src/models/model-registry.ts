// Stub module -- all exports present but not implemented
import type Anthropic from "@anthropic-ai/sdk";

export const MODEL_ALIASES: Record<string, string> = {};

export type ModelEntry = {
  id: string;
  displayName: string;
  contextWindow: number;
  alias?: string;
};

export function resolveModelAlias(_input: string): string {
  return "";
}

export function getModelAlias(_modelId: string): string | undefined {
  return undefined;
}

export async function listAvailableModels(
  _client: Anthropic,
): Promise<ModelEntry[]> {
  return [];
}

export function resolveDefaultModel(_options: {
  flagModel?: string;
  configModel?: string;
}): string {
  return "";
}

export function formatModelListEntry(_entry: ModelEntry): string {
  return "";
}
