import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isValidExistingBranchName } from "@paperclipai/shared";
import { Check, ChevronDown, GitBranch, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { SystemNoticeMetadataSections } from "./SystemNotice";
import { cn } from "../lib/utils";

export interface WorkspaceBaseRefRecoveryNoticeProps {
  requestedRef: string;
  repository: string;
  /** Only supply a default confirmed by the repository, never a guessed main/master. */
  defaultBranch?: string | null;
  agentName: string;
  /** Verified provenance, when available. */
  configuredBy?: string | null;
  taskOverride?: boolean;
  failureKind?: "missing_branch" | "unresolved_ref";
  unavailableReason?: string | null;
  /** Resolve only after both the task setting and retry have server receipts. */
  onRepair: (branch: string) => Promise<void>;
}

/** Inline task repair, also used by the interactive Storybook preview. */
export function WorkspaceBaseRefRecoveryNotice({
  requestedRef, repository, defaultBranch, agentName, configuredBy,
  taskOverride = true, failureKind = "unresolved_ref", unavailableReason, onRepair,
}: WorkspaceBaseRefRecoveryNoticeProps) {
  const { t } = useTranslation();
  const id = useId();
  const [editing, setEditing] = useState(!defaultBranch);
  const [branch, setBranch] = useState(defaultBranch ?? "");
  const [details, setDetails] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairedBranch, setRepairedBranch] = useState<string | null>(null);
  const inFlight = useRef(false);
  const changed = branch.trim().length > 0 && branch.trim() !== requestedRef;

  async function repair(nextBranch: string) {
    const value = nextBranch.trim();
    if (!value || value === requestedRef || unavailableReason || inFlight.current || repairedBranch) return;
    if (!isValidExistingBranchName(value)) {
      setError(t("workspaces.recovery.validBranchError", "Enter a valid branch name, such as master or release/next."));
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await onRepair(value);
      setRepairedBranch(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("workspaces.recovery.refreshTaskError", "Refresh the task to check its current state, then try again."));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 gap-3 rounded-lg border border-border bg-muted/20 p-4" data-testid="workspace-base-ref-recovery">
      {repairedBranch
        ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-(--status-task-icon-done)" />
        : <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-(--status-task-icon-blocked)" />}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          <h2 id={`${id}-title`} className="break-words text-sm font-semibold">
            {repairedBranch
              ? t("workspaces.recovery.branchUpdated", "Branch updated · retry requested")
              : failureKind === "missing_branch"
                ? t("workspaces.recovery.branchNotFound", "Branch {{branch}} was not found", { branch: requestedRef })
                : t("workspaces.recovery.couldntUseBranch", "Couldn’t use branch {{branch}}", { branch: requestedRef })}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {repairedBranch
              ? t("workspaces.recovery.startsFrom", "This task now starts from {{branch}}. A retry has been requested for {{agent}}.", {
                  branch: repairedBranch,
                  agent: agentName,
                })
              : (
                <>
                  {failureKind === "missing_branch"
                    ? t("workspaces.recovery.noBranchNamed", "{{repo}} has no branch named {{branch}}.", {
                        repo: repository,
                        branch: requestedRef,
                      })
                    : t("workspaces.recovery.couldNotResolve", "{{repo}} could not resolve the starting branch. Check the branch name and repository access.", {
                        repo: repository,
                      })}
                  {" "}
                  {t("workspaces.recovery.agentNotStarted", "{{agent}} hasn’t started.", { agent: agentName })}
                </>
              )}
          </p>
        </div>
        {!repairedBranch && (
          <>
            {defaultBranch && !editing && (
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <GitBranch aria-hidden className="size-4 text-muted-foreground" />
                <code className="font-mono">{defaultBranch}</code>
                <span className="text-muted-foreground">{t("workspaces.recovery.isDefaultBranch", "is the repository’s default branch.")}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">{t("workspaces.recovery.changesOnlyThisTask", "Changes only this task’s starting branch.")}</p>
            {unavailableReason && <p id={`${id}-unavailable`} className="text-sm text-muted-foreground">{unavailableReason}</p>}
            {error && <p role="alert" id={`${id}-error`} className="text-sm text-destructive">{t("workspaces.recovery.couldntConfirm", "Couldn’t confirm the repair. {{error}}", { error })}</p>}
            {editing ? (
              <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void repair(branch); }}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-branch`}>{t("workspaces.recovery.startingBranch", "Starting branch")}</Label>
                  <Input id={`${id}-branch`} autoFocus value={branch} disabled={pending || Boolean(unavailableReason)} onChange={event => setBranch(event.target.value)} placeholder={t("workspaces.recovery.branchPlaceholder", "Branch name")} className="font-mono" aria-describedby={error ? `${id}-error` : undefined} autoComplete="off" spellCheck={false} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {defaultBranch ? <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setEditing(false); setError(null); }}>{t("workspaces.recovery.cancel", "Cancel")}</Button> : <span />}
                  <Button type="submit" size="sm" disabled={pending || !changed || Boolean(unavailableReason)} aria-describedby={unavailableReason ? `${id}-unavailable` : undefined}>
                    {pending && <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? t("workspaces.recovery.savingRetry", "Saving & requesting retry…") : t("workspaces.recovery.saveBranchRetry", "Save branch & retry")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={pending || Boolean(unavailableReason)} onClick={() => setEditing(true)}>{t("workspaces.recovery.chooseAnotherBranch", "Choose another branch")}</Button>
                <Button type="button" size="sm" disabled={pending || Boolean(unavailableReason) || defaultBranch === requestedRef} aria-describedby={unavailableReason ? `${id}-unavailable` : undefined} onClick={() => void repair(defaultBranch!)}>
                  {pending && <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />}{pending ? t("workspaces.recovery.savingRetry", "Saving & requesting retry…") : t("workspaces.recovery.useDefaultRetry", "Use {{branch}} & retry", { branch: defaultBranch })}
                </Button>
              </div>
            )}
          </>
        )}
        <div>
          <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" aria-expanded={details} aria-controls={`${id}-details`} onClick={() => setDetails(value => !value)}>
            {details ? t("workspaces.recovery.hideDetails", "Hide details") : t("workspaces.recovery.whyDidThisHappen", "Why did this happen?")}<ChevronDown aria-hidden className={cn("size-3", details && "rotate-180")} />
          </Button>
          {details && <div id={`${id}-details`} className="mt-2 rounded-md border border-border bg-background">
            <SystemNoticeMetadataSections tone="neutral" sections={[{ rows: [
              { kind: "text", label: t("workspaces.recovery.setting", "Setting"), value: taskOverride ? t("workspaces.recovery.taskSpecificBranch", "Task-specific starting branch") : t("workspaces.recovery.workspaceStartingBranch", "Workspace starting branch") },
              { kind: "code", label: t("workspaces.recovery.requestedBranch", "Requested branch"), value: requestedRef },
              ...(configuredBy ? [{ kind: "text" as const, label: t("workspaces.recovery.setBy", "Set by"), value: configuredBy }] : []),
              { kind: "text", label: t("workspaces.recovery.whyStopped", "Why it stopped"), value: taskOverride ? t("workspaces.recovery.taskBranchWhy", "An explicit task branch overrides the repository default. Paperclip does not silently switch branches.") : t("workspaces.recovery.workspaceBranchWhy", "The configured starting branch must resolve before the agent can start. This repair overrides it for this task.") },
            ] }]} />
          </div>}
        </div>
      </div>
    </section>
  );
}
