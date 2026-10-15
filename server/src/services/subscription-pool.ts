import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getAllAntigravityAccountQuotas,
  selectAvailableAntigravityAccount,
  getQuotaWindows as getAntigravityQuotaWindows,
} from "@paperclipai/adapter-antigravity-local/server";
import { getQuotaWindows as getClaudeQuotaWindows } from "@paperclipai/adapter-claude-local/server";

export interface AccountPoolMemberConfig {
  key: string;
  label: string;
  profileDir?: string;
  sessionLimitTokens?: number;
  weeklyLimitTokens?: number;
}

export interface SubscriptionPoolConfig {
  managementProvider: "claude_local";
  managementModel: string;
  managementRoles: string[];
  workerProvider: "antigravity_local";
  workerModel: string;
  workerRoles: string[];
  workerAccountPool: AccountPoolMemberConfig[];
  manualActiveAccount?: string;
  rotationThresholdPct: number;
  autoRotateOnRateLimit: boolean;
  fallbackToOtherProvider: boolean;
}

const DEFAULT_POOL_CONFIG: SubscriptionPoolConfig = {
  managementProvider: "claude_local",
  managementModel: "claude-opus-5-5",
  managementRoles: ["ceo", "lead", "pm", "manager", "engineering_lead", "architect"],
  workerProvider: "antigravity_local",
  workerModel: "inherit",
  workerRoles: ["coder", "engineer", "qa", "devops", "worker", "researcher", "designer"],
  workerAccountPool: [
    { key: "account-1", label: "Antigravity Pro #1", sessionLimitTokens: 250_000, weeklyLimitTokens: 2_000_000 },
    { key: "account-2", label: "Antigravity Pro #2", sessionLimitTokens: 250_000, weeklyLimitTokens: 2_000_000 },
    { key: "account-3", label: "Antigravity Pro #3", sessionLimitTokens: 250_000, weeklyLimitTokens: 2_000_000 },
  ],
  rotationThresholdPct: 85,
  autoRotateOnRateLimit: true,
  fallbackToOtherProvider: true,
};

function getConfigFile(companyId: string): string {
  return path.join(os.homedir(), ".paperclip", "companies", companyId, "subscription-pool.json");
}

let activeWorkerIndex = 0;

export async function getSubscriptionPoolConfig(companyId: string): Promise<SubscriptionPoolConfig> {
  const file = getConfigFile(companyId);
  try {
    const raw = await fs.readFile(file, "utf8");
    return { ...DEFAULT_POOL_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_POOL_CONFIG };
  }
}

export async function saveSubscriptionPoolConfig(
  companyId: string,
  updates: Partial<SubscriptionPoolConfig>,
): Promise<SubscriptionPoolConfig> {
  const current = await getSubscriptionPoolConfig(companyId);
  const updated: SubscriptionPoolConfig = { ...current, ...updates };
  const file = getConfigFile(companyId);
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(updated, null, 2), "utf8");
  } catch {
    // Soft error
  }
  return updated;
}

export function isManagementRole(role: string, config: SubscriptionPoolConfig): boolean {
  const normalized = (role || "").toLowerCase().trim();
  return config.managementRoles.some((r) => normalized.includes(r.toLowerCase()));
}

export interface ResolvedExecutionAccount {
  provider: "claude_local" | "antigravity_local";
  model: string;
  accountKey?: string;
  accountLabel?: string;
  isRotated: boolean;
  statusText: string;
}

/**
 * Smart router: decides whether an agent should use Claude Pro (management)
 * or rotate among the Antigravity Pro accounts (workers).
 */
export async function resolveAgentExecutionAccount(
  companyId: string,
  agentRole: string,
): Promise<ResolvedExecutionAccount> {
  const config = await getSubscriptionPoolConfig(companyId);
  const forManagement = isManagementRole(agentRole, config);

  if (forManagement) {
    return {
      provider: "claude_local",
      model: config.managementModel,
      accountKey: "claude-pro",
      accountLabel: "Claude Pro (Gerência)",
      isRotated: false,
      statusText: `Alocado para Gerência (${agentRole})`,
    };
  }

  // Worker role: smart rotation across Antigravity Pro pool
  const poolKeys = config.workerAccountPool.map((m) => m.key);
  const selection = await selectAvailableAntigravityAccount(poolKeys, config.rotationThresholdPct);
  const selectedKey = (config.manualActiveAccount && poolKeys.includes(config.manualActiveAccount))
    ? config.manualActiveAccount
    : selection.selectedAccount;

  const member = config.workerAccountPool.find((m) => m.key === selectedKey);

  return {
    provider: "antigravity_local",
    model: config.workerModel,
    accountKey: selectedKey,
    accountLabel: member?.label ?? `Antigravity (${selectedKey})`,
    isRotated: selection.isFallback,
    statusText: selection.isFallback
      ? `Rotação de contingência: ${selection.status}`
      : `Conta ativa no pool: ${selectedKey}`,
  };
}

export function getAntigravityAccountCredentialsInfo(accountKey: string): { isConnected: boolean; email?: string } {
  try {
    const tokenPath = path.join(
      os.homedir(),
      ".paperclip",
      "credentials",
      "antigravity",
      accountKey,
      ".gemini",
      "antigravity-cli",
      "antigravity-oauth-token",
    );
    if (!fsSync.existsSync(tokenPath)) {
      return { isConnected: false };
    }
    const content = fsSync.readFileSync(tokenPath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || !parsed.token) {
      return { isConnected: false };
    }
    let email: string | undefined;
    if (typeof parsed.email === "string" && parsed.email) {
      email = parsed.email;
    } else if (typeof parsed.id_token === "string" && parsed.id_token.includes(".")) {
      try {
        const payloadBase64 = parsed.id_token.split(".")[1];
        const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(normalized, "base64").toString("utf8");
        const jwtPayload = JSON.parse(jsonStr);
        if (jwtPayload && typeof jwtPayload.email === "string") {
          email = jwtPayload.email;
        }
      } catch {
        // ignore JWT parse error
      }
    }
    return { isConnected: true, email };
  } catch {
    return { isConnected: false };
  }
}

export interface AccountLiveStatus {
  key: string;
  label: string;
  provider: string;
  roleType: "management" | "worker";
  status: "active" | "standby" | "cooling_down" | "exhausted";
  isConnected: boolean;
  email?: string;
  sessionUsagePct: number;
  weeklyUsagePct: number;
  sessionResetsAt: string | null;
  weeklyResetsAt: string | null;
  totalTokensFormatted: string;
  detail: string;
}

export interface SubscriptionPoolDashboardStatus {
  config: SubscriptionPoolConfig;
  activeWorkerAccount: string;
  managementAccount: AccountLiveStatus;
  workerAccounts: AccountLiveStatus[];
  lastUpdated: string;
}

export async function getSubscriptionPoolStatus(
  companyId: string,
): Promise<SubscriptionPoolDashboardStatus> {
  const config = await getSubscriptionPoolConfig(companyId);
  const now = Date.now();

  // 1. Probing Claude Pro
  let claudeSessionPct = 0;
  let claudeWeeklyPct = 0;
  let claudeSessionResets: string | null = null;
  let claudeWeeklyResets: string | null = null;
  let claudeStatus: AccountLiveStatus["status"] = "active";

  try {
    const claudeQuota = await getClaudeQuotaWindows();
    if (claudeQuota.ok) {
      for (const w of claudeQuota.windows) {
        if (w.label.includes("5h") || w.label.includes("5 hour")) {
          claudeSessionPct = w.usedPercent ?? 0;
          claudeSessionResets = w.resetsAt;
        }
        if (w.label.includes("7d") || w.label.includes("Weekly")) {
          claudeWeeklyPct = w.usedPercent ?? 0;
          claudeWeeklyResets = w.resetsAt;
        }
      }
      if (claudeSessionPct >= config.rotationThresholdPct) {
        claudeStatus = "exhausted";
      }
    }
  } catch {
    // If CLI offline or not probed
  }

  const managementStatus: AccountLiveStatus = {
    key: "claude-pro",
    label: "Claude Pro (Gestão & Liderança)",
    provider: "claude_local",
    roleType: "management",
    status: claudeStatus,
    isConnected: true,
    email: "Conta Claude Pro (Principal)",
    sessionUsagePct: claudeSessionPct,
    weeklyUsagePct: claudeWeeklyPct,
    sessionResetsAt: claudeSessionResets,
    weeklyResetsAt: claudeWeeklyResets,
    totalTokensFormatted: "Assinatura Pro",
    detail: "Dedicado para CEO, Tech Lead, PM e Tomada de Decisão",
  };

  // 2. Probing Antigravity pool
  const antigravityQuotas = await getAllAntigravityAccountQuotas();
  const poolSelection = await selectAvailableAntigravityAccount(
    config.workerAccountPool.map((m) => m.key),
    config.rotationThresholdPct,
  );
  const activeWorkerAccount = (config.manualActiveAccount && config.workerAccountPool.some((m) => m.key === config.manualActiveAccount))
    ? config.manualActiveAccount
    : poolSelection.selectedAccount;

  const workerStatuses: AccountLiveStatus[] = config.workerAccountPool.map((member) => {
    const quota = antigravityQuotas.find((q) => q.accountKey === member.key);
    const sessionWindow = quota?.windows.find((w) => w.label.includes("5h"));
    const weeklyWindow = quota?.windows.find((w) => w.label.includes("7d"));

    const sessionPct = sessionWindow?.usedPercent ?? 0;
    const weeklyPct = weeklyWindow?.usedPercent ?? 0;
    const creds = getAntigravityAccountCredentialsInfo(member.key);

    let status: AccountLiveStatus["status"] = "standby";
    if (member.key === activeWorkerAccount) {
      status = "active";
    }
    if (sessionPct >= config.rotationThresholdPct || weeklyPct >= config.rotationThresholdPct) {
      status = "exhausted";
    }

    return {
      key: member.key,
      label: member.label,
      provider: "antigravity_local",
      roleType: "worker",
      status,
      isConnected: creds.isConnected,
      email: creds.email,
      sessionUsagePct: sessionPct,
      weeklyUsagePct: weeklyPct,
      sessionResetsAt: sessionWindow?.resetsAt ?? null,
      weeklyResetsAt: weeklyWindow?.resetsAt ?? null,
      totalTokensFormatted: sessionWindow?.valueLabel ?? "0 tokens",
      detail: sessionWindow?.detail ?? (status === "active" ? "Conta em execução ativa para tarefas" : "Reserva pronta para rotação"),
    };
  });

  return {
    config,
    activeWorkerAccount,
    managementAccount: managementStatus,
    workerAccounts: workerStatuses,
    lastUpdated: new Date().toISOString(),
  };
}
