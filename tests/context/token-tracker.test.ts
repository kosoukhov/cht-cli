import { describe, it, expect } from "vitest";
import {
  formatTokenCount,
  formatUsageLine,
  TokenTracker,
} from "../../src/context/token-tracker.ts";

describe("formatTokenCount", () => {
  it("returns '0' for zero", () => {
    expect(formatTokenCount(0)).toBe("0");
  });

  it("returns raw number below 1000", () => {
    expect(formatTokenCount(350)).toBe("350");
    expect(formatTokenCount(1)).toBe("1");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("formats thousands with one decimal and 'k' suffix", () => {
    expect(formatTokenCount(1000)).toBe("1.0k");
    expect(formatTokenCount(1200)).toBe("1.2k");
    expect(formatTokenCount(45000)).toBe("45.0k");
    expect(formatTokenCount(999999)).toBe("1000.0k");
  });

  it("formats millions with one decimal and 'M' suffix", () => {
    expect(formatTokenCount(1000000)).toBe("1.0M");
    expect(formatTokenCount(1500000)).toBe("1.5M");
  });
});

describe("formatUsageLine", () => {
  it("produces exact UI-SPEC format", () => {
    // 800 < 1000, so raw number per UI-SPEC formatting rules
    expect(formatUsageLine(1200, 800, 200000)).toBe(
      "[tokens: 1.2k in / 800 out | context used 1%]",
    );
  });

  it("produces correct percentage for higher usage", () => {
    expect(formatUsageLine(90000, 5000, 200000)).toBe(
      "[tokens: 90.0k in / 5.0k out | context used 45%]",
    );
  });

  it("handles zero tokens", () => {
    expect(formatUsageLine(0, 0, 200000)).toBe(
      "[tokens: 0 in / 0 out | context used 0%]",
    );
  });
});

describe("TokenTracker", () => {
  it("starts with 0 input/output tokens", () => {
    const tracker = new TokenTracker(200000);
    expect(tracker.usagePercent).toBe(0);
  });

  it("update() stores cumulative input tokens for percentage", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(1200, 800);
    expect(tracker.usagePercent).toBe(1); // Math.round((1200/200000)*100) = 1
  });

  it("usagePercent returns Math.round((lastInputTokens / contextLimit) * 100)", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(100000, 5000);
    expect(tracker.usagePercent).toBe(50);
  });

  it("shouldWarn() returns false when usagePercent < 75", () => {
    const tracker = new TokenTracker(200000);
    // 74% = 148000 input tokens
    tracker.update(148000, 1000);
    expect(tracker.usagePercent).toBe(74);
    expect(tracker.shouldWarn()).toBe(false);
  });

  it("shouldWarn() returns true when usagePercent >= 75", () => {
    const tracker = new TokenTracker(200000);
    // 75% = 150000 input tokens
    tracker.update(150000, 1000);
    expect(tracker.usagePercent).toBe(75);
    expect(tracker.shouldWarn()).toBe(true);
  });

  it("shouldSummarize() returns false when usagePercent < 85", () => {
    const tracker = new TokenTracker(200000);
    // 84% = 168000 input tokens
    tracker.update(168000, 1000);
    expect(tracker.usagePercent).toBe(84);
    expect(tracker.shouldSummarize()).toBe(false);
  });

  it("shouldSummarize() returns true when usagePercent >= 85", () => {
    const tracker = new TokenTracker(200000);
    // 85% = 170000 input tokens
    tracker.update(170000, 1000);
    expect(tracker.usagePercent).toBe(85);
    expect(tracker.shouldSummarize()).toBe(true);
  });

  it("formatUsageLine() returns exact UI-SPEC formatted string", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(1200, 800);
    // 800 < 1000, so raw number per UI-SPEC formatting rules
    expect(tracker.formatUsageLine()).toBe(
      "[tokens: 1.2k in / 800 out | context used 1%]",
    );
  });

  it("formatWarningLine() returns null when below threshold", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(1200, 800);
    expect(tracker.formatWarningLine()).toBeNull();
  });

  it("formatWarningLine() returns warning string when at threshold", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(150000, 1000);
    expect(tracker.formatWarningLine()).toBe(
      "[warning: context 75% full -- approaching limit]",
    );
  });

  it("formatWarningLine() includes correct percentage", () => {
    const tracker = new TokenTracker(200000);
    tracker.update(180000, 1000);
    expect(tracker.formatWarningLine()).toBe(
      "[warning: context 90% full -- approaching limit]",
    );
  });

  describe("updateLimit", () => {
    it("changes the context limit", () => {
      const tracker = new TokenTracker(200_000);
      tracker.updateLimit(1_000_000);
      expect(tracker.contextLimit).toBe(1_000_000);
    });

    it("recalculates usagePercent with new limit", () => {
      const tracker = new TokenTracker(200_000);
      tracker.update(150_000, 5_000);
      expect(tracker.usagePercent).toBe(75); // 150k/200k
      tracker.updateLimit(1_000_000);
      expect(tracker.usagePercent).toBe(15); // 150k/1M
    });

    it("detects overflow when downgrading", () => {
      const tracker = new TokenTracker(1_000_000);
      tracker.update(150_000, 5_000);
      expect(tracker.shouldWarn()).toBe(false); // 15% of 1M
      tracker.updateLimit(100_000);
      expect(tracker.shouldWarn()).toBe(true); // 150% of 100k
    });
  });
});
