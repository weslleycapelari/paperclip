import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ProviderQuotaResult, QuotaWindow, UsageSummary } from "@paperclipai/adapter-utils";

export interface AntigravityAccountQuotaResult extends ProviderQuotaResult {
  accountKey?: string;
  accountLabel?: string;
  capturedAt?: string;
}

interface UsageEvent {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  success: boolean;
}

interface AccountQuotaState {
  accountKey: string;
  accountLabel: string;
  events: UsageEvent[];
  cooldownUntil: number | null;
  cooldownReason: string | null;
  customSessionLimitTokens?: number;
  customWeeklyLimitTokens?: number;
}

interface QuotaStore {
  accounts: Record<string, AccountQuotaState>;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Default Antigravity Pro baseline capacities (estimated token capacity per window)
const DEFAULT_SESSION_TOKEN_CAPACITY = 250_000;
const DEFAULT_WEEKLY_TOKEN_CAPACITY = 2_000_000;

function getStorePath(): string {
  const custom = process.env.PAPERCLIP_ANTIGRAVITY_QUOTA_FILE;
  if (custom && custom.trim()) return custom.trim();
  return path.join(os.homedir(), ".paperclip", "antigravity-usage-ledger.json");
}

let inMemoryStore: QuotaStore | null = null;
let saveTimer: NodeJS.Timeout | null = null;

async function loadStore(): Promise<QuotaStore> {
  if (inMemoryStore) return inMemoryStore;
  const storePath = getStorePath();
  try {
    const raw = await fs.readFile(storePath, "utf8");
    inMemoryStore = JSON.parse(raw) as QuotaStore;
  } catch {
    inMemoryStore = { accounts: {} };
  }
  return inMemoryStore!;
}

async function persistStore(): Promise<void> {
  if (!inMemoryStore) return;
  const storePath = getStorePath();
  try {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(inMemoryStore, null, 2), "utf8");
  } catch (err) {
    // Soft error on persisting
  }
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistStore();
  }, 2000);
}

function pruneOldEvents(events: UsageEvent[], now: number): UsageEvent[] {
  const cutoff = now - SEVEN_DAYS_MS;
  return events.filter((e) => e.timestamp >= cutoff);
}

export function recordAntigravityRunUsage(
  accountKey = "default",
  usage: UsageSummary,
  success: boolean,
): void {
  const now = Date.now();
  void loadStore().then((store) => {
    if (!store.accounts[accountKey]) {
      store.accounts[accountKey] = {
        accountKey,
        accountLabel: accountKey === "default" ? "Antigravity Pro (Padrão)" : `Antigravity (${accountKey})`,
        events: [],
        cooldownUntil: null,
        cooldownReason: null,
      };
    }

    const state = store.accounts[accountKey];
    state.events = pruneOldEvents(state.events, now);
    const total = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    state.events.push({
      timestamp: now,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: total,
      success,
    });

    scheduleSave();
  });
}

export function setAntigravityCooldown(
  accountKey: string,
  cooldownUntil: number,
  reason = "Limite de requisições / Rate limit atingido",
): void {
  void loadStore().then((store) => {
    if (!store.accounts[accountKey]) {
      store.accounts[accountKey] = {
        accountKey,
        accountLabel: `Antigravity (${accountKey})`,
        events: [],
        cooldownUntil: null,
        cooldownReason: null,
      };
    }
    store.accounts[accountKey].cooldownUntil = cooldownUntil;
    store.accounts[accountKey].cooldownReason = reason;
    scheduleSave();
  });
}

export async function calculateAccountQuotaWindows(
  accountState: AccountQuotaState,
  now = Date.now(),
): Promise<QuotaWindow[]> {
  const events = pruneOldEvents(accountState.events, now);
  accountState.events = events;

  const fiveHoursCutoff = now - FIVE_HOURS_MS;
  const events5h = events.filter((e) => e.timestamp >= fiveHoursCutoff);
  const tokens5h = events5h.reduce((sum, e) => sum + e.totalTokens, 0);

  const tokens7d = events.reduce((sum, e) => sum + e.totalTokens, 0);

  const capacity5h = accountState.customSessionLimitTokens ?? DEFAULT_SESSION_TOKEN_CAPACITY;
  const capacity7d = accountState.customWeeklyLimitTokens ?? DEFAULT_WEEKLY_TOKEN_CAPACITY;

  let usedPct5h = Math.min(100, Math.round((tokens5h / capacity5h) * 100));
  let usedPct7d = Math.min(100, Math.round((tokens7d / capacity7d) * 100));

  let resetsAt5h: string | null = null;
  if (events5h.length > 0) {
    const oldest5h = Math.min(...events5h.map((e) => e.timestamp));
    resetsAt5h = new Date(oldest5h + FIVE_HOURS_MS).toISOString();
  }

  let resetsAt7d: string | null = null;
  if (events.length > 0) {
    const oldest7d = Math.min(...events.map((e) => e.timestamp));
    resetsAt7d = new Date(oldest7d + SEVEN_DAYS_MS).toISOString();
  }

  // If in active cooldown, reflect in the session window
  if (accountState.cooldownUntil && accountState.cooldownUntil > now) {
    usedPct5h = Math.max(usedPct5h, 95);
    resetsAt5h = new Date(accountState.cooldownUntil).toISOString();
  }

  return [
    {
      label: "5h (Sessão)",
      usedPercent: usedPct5h,
      resetsAt: resetsAt5h,
      valueLabel: `${tokens5h.toLocaleString()} tokens`,
      detail: `${events5h.length} execuções nas últimas 5h${accountState.cooldownReason ? ` [${accountState.cooldownReason}]` : ""}`,
    },
    {
      label: "7d (Semanal)",
      usedPercent: usedPct7d,
      resetsAt: resetsAt7d,
      valueLabel: `${tokens7d.toLocaleString()} tokens`,
      detail: `${events.length} execuções nos últimos 7 dias`,
    },
  ];
}

export async function getQuotaWindows(): Promise<AntigravityAccountQuotaResult> {
  const store = await loadStore();
  const defaultAccount = store.accounts["default"] ?? {
    accountKey: "default",
    accountLabel: "Antigravity Pro",
    events: [],
    cooldownUntil: null,
    cooldownReason: null,
  };

  const windows = await calculateAccountQuotaWindows(defaultAccount);

  return {
    provider: "antigravity",
    accountKey: "default",
    accountLabel: defaultAccount.accountLabel,
    capturedAt: new Date().toISOString(),
    source: "local-ledger",
    ok: true,
    windows,
  };
}

export async function getAllAntigravityAccountQuotas(): Promise<AntigravityAccountQuotaResult[]> {
  const store = await loadStore();
  const keys = Object.keys(store.accounts);
  if (keys.length === 0) {
    return [await getQuotaWindows()];
  }

  const results: AntigravityAccountQuotaResult[] = [];
  for (const key of keys) {
    const account = store.accounts[key];
    const windows = await calculateAccountQuotaWindows(account);
    results.push({
      provider: "antigravity",
      accountKey: account.accountKey,
      accountLabel: account.accountLabel,
      capturedAt: new Date().toISOString(),
      source: "local-ledger",
      ok: true,
      windows,
    });
  }
  return results;
}

/**
 * Smart rotation helper: selects the best available account from a pool
 * of account keys based on threshold (e.g. 85%) and cooldown state.
 */
export async function selectAvailableAntigravityAccount(
  accountPool: string[] = ["account-1", "account-2", "account-3"],
  thresholdPct = 85,
): Promise<{ selectedAccount: string; isFallback: boolean; status: string }> {
  if (accountPool.length === 0) {
    return { selectedAccount: "default", isFallback: false, status: "single_default" };
  }

  const store = await loadStore();
  const now = Date.now();

  const candidates = [];
  for (const key of accountPool) {
    const acc = store.accounts[key] ?? {
      accountKey: key,
      accountLabel: `Antigravity (${key})`,
      events: [],
      cooldownUntil: null,
      cooldownReason: null,
    };
    const windows = await calculateAccountQuotaWindows(acc, now);
    const sessionPct = windows[0]?.usedPercent ?? 0;
    const weeklyPct = windows[1]?.usedPercent ?? 0;
    const maxPct = Math.max(sessionPct, weeklyPct);
    const inCooldown = acc.cooldownUntil != null && acc.cooldownUntil > now;

    candidates.push({
      key,
      maxPct,
      inCooldown,
    });
  }

  // Filter accounts not in cooldown and under threshold
  const available = candidates.filter((c) => !c.inCooldown && c.maxPct < thresholdPct);
  if (available.length > 0) {
    // Pick the one with lowest usage
    available.sort((a, b) => a.maxPct - b.maxPct);
    return {
      selectedAccount: available[0].key,
      isFallback: false,
      status: `active (${available[0].maxPct}% used)`,
    };
  }

  // If all are above threshold, pick the one not in cooldown with lowest usage
  const notCooling = candidates.filter((c) => !c.inCooldown);
  if (notCooling.length > 0) {
    notCooling.sort((a, b) => a.maxPct - b.maxPct);
    return {
      selectedAccount: notCooling[0].key,
      isFallback: true,
      status: `fallback (${notCooling[0].maxPct}% used)`,
    };
  }

  // All in cooldown: return the first account with warning
  return {
    selectedAccount: accountPool[0],
    isFallback: true,
    status: "all_cooldown",
  };
}
