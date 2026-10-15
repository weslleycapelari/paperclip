import { describe, it, expect } from "vitest";
import {
  calculateAccountQuotaWindows,
  selectAvailableAntigravityAccount,
  setAntigravityCooldown,
  getQuotaWindows,
} from "./quota.js";

describe("calculateAccountQuotaWindows", () => {
  it("calculates 5-hour and 7-day usage percentage from events", async () => {
    const now = Date.now();
    const accountState = {
      accountKey: "account-1",
      accountLabel: "Antigravity Pro #1",
      events: [
        {
          timestamp: now - 1000 * 60 * 30, // 30 mins ago
          inputTokens: 50_000,
          outputTokens: 10_000,
          totalTokens: 60_000,
          success: true,
        },
        {
          timestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
          inputTokens: 40_000,
          outputTokens: 10_000,
          totalTokens: 50_000,
          success: true,
        },
      ],
      cooldownUntil: null,
      cooldownReason: null,
      customSessionLimitTokens: 200_000,
      customWeeklyLimitTokens: 1_000_000,
    };

    const windows = await calculateAccountQuotaWindows(accountState, now);
    expect(windows).toHaveLength(2);

    // 5h window: 110,000 / 200,000 = 55%
    expect(windows[0].label).toBe("5h (Sessão)");
    expect(windows[0].usedPercent).toBe(55);
    expect(windows[0].resetsAt).not.toBeNull();

    // 7d window: 110,000 / 1,000,000 = 11%
    expect(windows[1].label).toBe("7d (Semanal)");
    expect(windows[1].usedPercent).toBe(11);
  });

  it("reflects active cooldown in the session window", async () => {
    const now = Date.now();
    const cooldownTime = now + 1000 * 60 * 60; // 1 hour in future
    const accountState = {
      accountKey: "account-2",
      accountLabel: "Antigravity Pro #2",
      events: [],
      cooldownUntil: cooldownTime,
      cooldownReason: "429 Rate limit",
    };

    const windows = await calculateAccountQuotaWindows(accountState, now);
    expect(windows[0].usedPercent).toBe(95);
    expect(windows[0].resetsAt).toBe(new Date(cooldownTime).toISOString());
  });
});
