import type Anthropic from "@anthropic-ai/sdk";
import { MODEL_CONTEXT_WINDOWS } from "../context/context-window.ts";
import { formatTokenCount } from "../context/token-tracker.ts";

/** Short alias -> full model ID mapping. */
export const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
  haiku: "claude-haiku-4-5",
};

/** Model entry returned by discovery/fallback. */
export type ModelEntry = {
  id: string;
  displayName: string;
  contextWindow: number;
  alias?: string;
};

/**
 * Resolve a short alias (e.g. "sonnet") to a full model ID.
 * Case-insensitive. Unknown inputs are returned unchanged.
 */
export function resolveModelAlias(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
}

/**
 * Reverse lookup: full model ID -> short alias, or undefined if none.
 */
export function getModelAlias(modelId: string): string | undefined {
  return Object.entries(MODEL_ALIASES).find(
    ([, id]) => id === modelId,
  )?.[0];
}

/**
 * Discover available models via the Anthropic API.
 * Falls back to the hardcoded MODEL_CONTEXT_WINDOWS map on error.
 *
 * Filters to claude-* models with valid (non-null, >0) max_input_tokens.
 */
export async function listAvailableModels(
  client: Anthropic,
): Promise<ModelEntry[]> {
  try {
    const entries: ModelEntry[] = [];
    for await (const model of client.models.list({ limit: 100 })) {
      if (
        model.id.startsWith("claude-") &&
        model.max_input_tokens &&
        model.max_input_tokens > 0
      ) {
        entries.push({
          id: model.id,
          displayName: model.display_name,
          contextWindow: model.max_input_tokens,
          alias: getModelAlias(model.id),
        });
      }
    }
    return entries;
  } catch {
    // Fallback to hardcoded context window data
    return Object.entries(MODEL_CONTEXT_WINDOWS).map(([id, contextWindow]) => ({
      id,
      displayName: id,
      contextWindow,
      alias: getModelAlias(id),
    }));
  }
}

/**
 * Resolve the default model using priority chain:
 *   1. --model flag value (alias-resolved)
 *   2. Project config model (alias-resolved)
 *   3. ANTHROPIC_DEFAULT_SONNET_MODEL env var
 *   4. Hardcoded fallback: claude-sonnet-4-20250514
 */
export function resolveDefaultModel(options: {
  flagModel?: string;
  configModel?: string;
}): string {
  if (options.flagModel) return resolveModelAlias(options.flagModel);
  if (options.configModel) return resolveModelAlias(options.configModel);
  if (process.env.ANTHROPIC_DEFAULT_SONNET_MODEL) {
    return process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  }
  return "claude-sonnet-4-20250514";
}

/**
 * Format a model entry for display in the model list.
 * Example: "claude-sonnet-4-6 (sonnet)  1.0M context"
 */
export function formatModelListEntry(entry: ModelEntry): string {
  const aliasStr = entry.alias ? ` (${entry.alias})` : "";
  return `${entry.id}${aliasStr}  ${formatTokenCount(entry.contextWindow)} context`;
}
