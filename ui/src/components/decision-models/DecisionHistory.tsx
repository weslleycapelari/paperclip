import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { DecisionHistoryEntry } from "@paperclipai/shared";
import { decisionModelsApi } from "@/api/decision-models";
import { Link } from "@/lib/router";
import { formatDateTime, formatTokens, formatDetailedCents } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFastResponsesEnabled } from "@/hooks/useFastResponsesEnabled";

export function DecisionHistoryTable({ entries, fastResponse = false, connectionsEnabled = true }: { entries: (DecisionHistoryEntry & { publicationStatus?: string; connectionName?: string | null })[]; fastResponse?: boolean; connectionsEnabled?: boolean }) {
  const { t } = useTranslation();
  if (!entries.length) return <p className="text-sm text-muted-foreground">{fastResponse ? t("decisionModels.history.noFastResponses", "No fast responses in this period.") : t("decisionModels.history.noDecisionRequests", "No decision requests in this period.")} <Link to={connectionsEnabled ? "/company/settings/connections" : fastResponse ? "/company/settings/instance/experimental" : "/company/settings"} className="underline underline-offset-4">{fastResponse ? connectionsEnabled ? t("decisionModels.history.configureFastResponse", "Configure fast response") : t("decisionModels.history.enableExperimentalFastResponses", "Enable experimental fast responses") : t("decisionModels.history.configureDecisionModel", "Configure a decision model")}</Link> {t("decisionModels.history.toRunTest", "to run a test.")}</p>;
  const columns = [
    t("decisionModels.history.columns.whenFeature", "When / feature"),
    t("decisionModels.history.columns.responsible", "Responsible"),
    t("decisionModels.history.columns.task", "Task"),
    ...(fastResponse ? [t("decisionModels.history.columns.connection", "Connection")] : []),
    t("decisionModels.history.columns.model", "Model"),
    t("decisionModels.history.columns.status", "Status"),
    t("decisionModels.history.columns.duration", "Duration"),
    t("decisionModels.history.columns.tokensInOut", "Tokens in / out"),
    t("decisionModels.history.columns.cost", "Cost"),
  ];
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">{t("decisionModels.history.recentRequestsNotice", "Recent requests. Inputs are not retained.")}</p>
    <div className="overflow-x-auto"><table className="w-full text-sm" aria-label={fastResponse ? t("decisionModels.history.ariaFastResponses", "Fast responses") : t("decisionModels.history.ariaDecisionRequests", "Decision requests")}>
      <thead><tr className="border-b border-border text-muted-foreground">{columns.map(label => <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>)}</tr></thead>
      <tbody>{entries.map(row => <tr key={row.id} className="border-b border-border last:border-0">
        <td className="px-3 py-3"><div className="whitespace-nowrap">{formatDateTime(row.startedAt)}</div><div className="text-xs text-muted-foreground">{row.feature === "settings.test" ? t("decisionModels.history.setupTest", "Setup test") : row.feature}</div></td>
        <td className="px-3 py-3">{row.actorType === "system" ? t("decisionModels.history.paperclipServices", "Paperclip services") : row.userName ?? (row.responsibleUserId === "local-board" ? t("decisionModels.history.board", "Board") : t("decisionModels.history.formerUser", "Former user"))}</td>
        <td className="px-3 py-3">{row.issueId ? <Link className="underline underline-offset-4" to={`/issues/${row.issueIdentifier ?? row.issueId}`}>{row.issueIdentifier ?? t("decisionModels.history.viewTask", "View task")}</Link> : "—"}</td>
        {fastResponse && <td className="px-3 py-3">{row.connectionName ?? (row.connectionId ? t("decisionModels.history.removedConnection", "Removed connection") : "—")}</td>}
        <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
        <td className="px-3 py-3"><div>{row.status === "succeeded" ? "Succeeded" : row.status === "running" ? "Running" : row.status === "unknown" ? "Unresolved" : row.status === "skipped" ? "Skipped" : row.status === "pending" ? "Pending" : "Failed"}</div>{row.publicationStatus && <div className="text-xs text-muted-foreground">{row.publicationStatus}</div>}{row.errorCode && <div className="text-xs text-muted-foreground">{row.errorCode.replaceAll("_", " ")}</div>}</td>
        <td className="px-3 py-3 font-mono">{row.durationMs === null ? "—" : `${(row.durationMs / 1000).toFixed(1)}s`}</td>
        <td className="whitespace-nowrap px-3 py-3 font-mono">{row.inputTokens === null ? "—" : formatTokens(row.inputTokens)} / {row.outputTokens === null ? "—" : formatTokens(row.outputTokens)}</td>
        <td className="px-3 py-3 font-mono"><div>{row.costCents === null ? t("decisionModels.history.unknown", "Unknown") : formatDetailedCents(row.costCents)}</div>{row.costStatus !== "unpriced" && row.costStatus && <span className="text-xs text-muted-foreground">{row.costStatus === "estimated" ? t("decisionModels.history.estimated", "Estimated") : t("decisionModels.history.reported", "Reported")}</span>}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
export function DecisionHistory({ companyId, from, to }: { companyId: string; from?: string | null; to?: string | null }) {
  const { t } = useTranslation();
  const { enabled } = useFastResponsesEnabled();
  const query = useQuery({ queryKey: ["decision-history", companyId, from, to], queryFn: () => decisionModelsApi.history(companyId, from, to), refetchInterval: q => q.state.data?.some(row => row.status === "running") ? 5000 : false });
  if (query.isPending) return <p className="text-sm text-muted-foreground">{t("decisionModels.history.loading", "Loading decision requests…")}</p>;
  if (query.error) return <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{t("decisionModels.history.loadError", "Could not load decision requests.")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("decisionModels.tryAgain", "Try again")}</Button></div>;
  return <DecisionHistoryTable entries={query.data ?? []} connectionsEnabled={enabled} />;
}
