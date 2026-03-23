import { WARN_THRESHOLD, SUMMARIZE_THRESHOLD } from "./context-window.ts";

/**
 * Format a token count for compact display.
 * - Below 1,000: raw number ("350")
 * - 1,000 to 999,999: one decimal + "k" ("1.2k", "45.0k")
 * - 1,000,000+: one decimal + "M" ("1.0M")
 */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Format the per-response usage line (exact UI-SPEC string).
 * Example: "[tokens: 1.2k in / 0.8k out | context used 45%]"
 */
export function formatUsageLine(
  inputTokens: number,
  outputTokens: number,
  contextLimit: number,
): string {
  const usedPercent = Math.round((inputTokens / contextLimit) * 100);
  return `[tokens: ${formatTokenCount(inputTokens)} in / ${formatTokenCount(outputTokens)} out | context used ${usedPercent}%]`;
}

/**
 * Tracks token usage across API responses.
 * Stores the last input/output token counts and computes context window usage.
 */
export class TokenTracker {
  private contextLimit: number;
  private lastInputTokens = 0;
  private lastOutputTokens = 0;

  constructor(contextLimit: number) {
    this.contextLimit = contextLimit;
  }

  /** Update with the latest API response usage stats. */
  update(inputTokens: number, outputTokens: number): void {
    this.lastInputTokens = inputTokens;
    this.lastOutputTokens = outputTokens;
  }

  /** Context usage percentage (rounded integer). */
  get usagePercent(): number {
    return Math.round((this.lastInputTokens / this.contextLimit) * 100);
  }

  /** True when usage exceeds the warning threshold (75%). */
  shouldWarn(): boolean {
    return this.lastInputTokens / this.contextLimit >= WARN_THRESHOLD;
  }

  /** True when usage exceeds the summarization threshold (85%). */
  shouldSummarize(): boolean {
    return this.lastInputTokens / this.contextLimit >= SUMMARIZE_THRESHOLD;
  }

  /** Format the per-response usage line for display. */
  formatUsageLine(): string {
    return formatUsageLine(
      this.lastInputTokens,
      this.lastOutputTokens,
      this.contextLimit,
    );
  }

  /**
   * Format a warning line if usage exceeds the warning threshold.
   * Returns null if below threshold.
   */
  formatWarningLine(): string | null {
    if (!this.shouldWarn()) return null;
    return `[warning: context ${this.usagePercent}% full -- approaching limit]`;
  }
}
