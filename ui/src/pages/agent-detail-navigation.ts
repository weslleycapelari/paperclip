import { auditSectionHref, type AuditSection } from "./audit/audit-navigation";

export type AgentDetailView =
  | "overview"
  | "instructions"
  | "skills"
  | "runtime"
  | "secrets"
  | "tools"
  | "channels"
  | "permissions"
  | "api-keys"
  | "revisions"
  | "run-detail";

export type AgentLocalDetailView = Exclude<AgentDetailView, "run-detail">;

import { t } from "@/i18n";

export const getAgentDetailNavigation = (translate = t): ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ value: AgentLocalDetailView; label: string }>;
}> => [
  {
    label: translate("agents.tabs.agent", { defaultValue: "Agent" }),
    items: [
      { value: "overview", label: translate("agents.tabs.overview", { defaultValue: "Overview" }) },
      { value: "instructions", label: translate("agents.tabs.instructions", { defaultValue: "Instructions" }) },
      { value: "skills", label: translate("agents.tabs.skills", { defaultValue: "Skills" }) },
    ],
  },
  {
    label: translate("agents.tabs.runtime", { defaultValue: "Runtime" }),
    items: [
      { value: "runtime", label: translate("agents.tabs.runtime", { defaultValue: "Harness / Runtime" }) },
      { value: "secrets", label: translate("agents.tabs.secrets", { defaultValue: "Secrets" }) },
      { value: "tools", label: translate("agents.tabs.tools", { defaultValue: "Tools" }) },
      { value: "channels", label: translate("agents.tabs.channels", { defaultValue: "Channels" }) },
    ],
  },
  {
    label: translate("agents.tabs.governance", { defaultValue: "Governance" }),
    items: [
      { value: "permissions", label: translate("agents.tabs.permissions", { defaultValue: "Permissions / Trust" }) },
      { value: "api-keys", label: translate("agents.tabs.apiKeys", { defaultValue: "API Keys" }) },
      { value: "revisions", label: translate("agents.tabs.revisions", { defaultValue: "Revisions" }) },
    ],
  },
];

export const AGENT_DETAIL_NAVIGATION = getAgentDetailNavigation();

export function parseAgentDetailView(value: string | null): AgentLocalDetailView {
  if (value === "instructions" || value === "prompts") return "instructions";
  if (value === "skills") return "skills";
  if (value === "runtime" || value === "configure" || value === "configuration") return "runtime";
  if (value === "secrets") return "secrets";
  if (value === "tools") return "tools";
  if (value === "channels") return "channels";
  if (value === "permissions" || value === "trust") return "permissions";
  if (value === "api-keys" || value === "keys") return "api-keys";
  if (value === "revisions" || value === "history") return "revisions";
  return "overview";
}

export function agentDetailHref(agentRef: string, view: AgentLocalDetailView = "overview") {
  return `/agents/${agentRef}/${view}`;
}

export function agentLegacyAuditSection(value: string | null): AuditSection | null {
  if (value === "runs") return "runs";
  if (value === "audit" || value === "activity") return "activity";
  if (value === "cost" || value === "costs") return "costs";
  if (value === "budget" || value === "budgets") return "budgets";
  return null;
}

export function agentScopedAuditHref(agentId: string, section: AuditSection) {
  return auditSectionHref(section, {
    mode: section === "activity" ? "agents" : undefined,
    agentId,
  });
}
