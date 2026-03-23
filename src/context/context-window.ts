// Model context window defaults (verified from Anthropic docs March 2026)
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Latest generation (1M native)
  "claude-opus-4-6": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  // Previous generation (200k)
  "claude-sonnet-4-5-20250929": 200_000,
  "claude-sonnet-4-5": 200_000,
  "claude-sonnet-4-20250514": 200_000,
  "claude-sonnet-4-0": 200_000,
  "claude-opus-4-5-20251101": 200_000,
  "claude-opus-4-5": 200_000,
  "claude-opus-4-1-20250805": 200_000,
  "claude-opus-4-0": 200_000,
  // Haiku
  "claude-haiku-4-5-20251001": 200_000,
  "claude-haiku-4-5": 200_000,
};

// Fallback for unknown models (custom endpoints)
export const DEFAULT_CONTEXT_WINDOW = 200_000;

// Warning at 75% -- accounts for output token headroom (per UI-SPEC)
export const WARN_THRESHOLD = 0.75;

// Auto-summarize at 85% (per UI-SPEC)
export const SUMMARIZE_THRESHOLD = 0.85;

/**
 * Get context window limit for a model.
 * User override (from project _config.yaml) takes precedence over model lookup.
 */
export function getContextWindowLimit(
  model: string,
  userOverride?: number,
): number {
  if (userOverride) return userOverride;
  return MODEL_CONTEXT_WINDOWS[model] ?? DEFAULT_CONTEXT_WINDOW;
}
