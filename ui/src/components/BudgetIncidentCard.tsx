import { useState } from "react";
import type { BudgetIncident } from "@paperclipai/shared";
import { AlertOctagon, AlertTriangle, ArrowUpRight, PauseCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { formatCents } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function centsInputValue(value: number) {
  return (value / 100).toFixed(2);
}

function parseDollarInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function BudgetIncidentCard({
  incident,
  onRaiseAndResume,
  onKeepPaused,
  isMutating,
}: {
  incident: BudgetIncident;
  onRaiseAndResume: (amountCents: number) => void;
  onKeepPaused: () => void;
  isMutating?: boolean;
}) {
  const { t } = useTranslation();
  const isWarning = incident.thresholdType === "soft";
  const [draftAmount, setDraftAmount] = useState(
    centsInputValue(isWarning
      ? Math.max(incident.amountObserved, incident.amountLimit) + 1000
      : Math.max(incident.amountObserved + 1000, incident.amountLimit)),
  );
  const parsed = parseDollarInput(draftAmount);

  const stateLabel = (() => {
    if (incident.status === "resolved") return t("budgets.incidentCard.states.resolved", "Resolved");
    if (incident.status === "dismissed") return t("budgets.incidentCard.states.dismissed", "Dismissed");
    if (incident.approvalStatus === "revision_requested") return t("budgets.incidentCard.states.escalated", "Escalated");
    if (incident.approvalStatus === "pending") return t("budgets.incidentCard.states.pendingApproval", "Pending approval");
    return t("budgets.incidentCard.states.open", "Open");
  })();

  return (
    <Card className={isWarning ? "overflow-hidden border-amber-500/30 bg-amber-500/5" : "overflow-hidden border-red-500/20 bg-(image:--gradient-extract-4)"}>
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={isWarning
                ? "text-(length:--text-micro) uppercase tracking-(--tracking-caps) text-amber-700 dark:text-amber-200"
                : "text-(length:--text-micro) uppercase tracking-(--tracking-caps) text-red-700/90 dark:text-red-200/80"}>
                {isWarning
                  ? t("budgets.incidentCard.warningTitle", "{{scope}} budget warning", { scope: incident.scopeType })
                  : t("budgets.incidentCard.hardStopTitle", "{{scope}} hard stop", { scope: incident.scopeType })}
              </div>
              <Badge variant={incident.status === "resolved" ? "outline" : "secondary"}>
                {stateLabel}
              </Badge>
            </div>
            <CardTitle className={isWarning ? "mt-1 text-base" : "mt-1 text-base text-red-950 dark:text-red-50"}>{incident.scopeName}</CardTitle>
            <CardDescription className={isWarning ? "mt-1" : "mt-1 text-red-900/75 dark:text-red-100/70"}>
              {incident.thresholdType === "hard" && incident.amountObserved < incident.amountLimit
                ? t("budgets.incidentCard.descIncomplete", "Accounting is incomplete. Known spend is {{spend}}; review pending or unpriced usage in the budget policy.", { spend: formatCents(incident.amountObserved) })
                : t("budgets.incidentCard.descLimitReached", "Spending reached {{spend}} against a limit of {{limit}}.", { spend: formatCents(incident.amountObserved), limit: formatCents(incident.amountLimit) })}
            </CardDescription>
          </div>
          {isWarning ? (
            <div className="rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
          ) : (
            <div className="rounded-full border border-red-400/30 bg-red-500/10 p-2 text-red-600 dark:text-red-200">
              <AlertOctagon className="h-4 w-4" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-0">
        {isWarning ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-50/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {t("budgets.incidentCard.warningDesc", "Spending crossed the warning threshold. This warning does not pause work.")}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-950/90 dark:text-red-50/90">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {incident.scopeType === "project"
                ? t("budgets.incidentCard.projectPausedDesc", "Project execution is paused. New work in this project will not start until you resolve the budget incident.")
                : t("budgets.incidentCard.scopePausedDesc", "This scope is paused. New heartbeats will not start until you resolve the budget incident.")}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <label className="text-(length:--text-micro) uppercase tracking-(--tracking-caps) text-muted-foreground">
            {t("budgets.incidentCard.newBudgetUsd", "New budget (USD)")}
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              value={draftAmount}
              onChange={(event) => setDraftAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
            <Button
              className="gap-2"
              disabled={isMutating || parsed === null || parsed <= incident.amountObserved}
              onClick={() => {
                if (typeof parsed === "number") onRaiseAndResume(parsed);
              }}
            >
              <ArrowUpRight className="h-4 w-4" />
              {isMutating ? t("budgets.incidentCard.applying", "Applying...") : isWarning ? t("budgets.incidentCard.raiseBudget", "Raise budget") : t("budgets.incidentCard.raiseBudgetAndResume", "Raise budget & resume")}
            </Button>
          </div>
          {parsed !== null && parsed <= incident.amountObserved ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-200/80">
              {t("budgets.incidentCard.mustExceedObserved", "The new budget must exceed current observed spend.")}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" className="text-muted-foreground" disabled={isMutating} onClick={onKeepPaused}>
            {isWarning ? t("budgets.incidentCard.dismissWarning", "Dismiss warning") : t("budgets.incidentCard.keepPaused", "Keep paused")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
