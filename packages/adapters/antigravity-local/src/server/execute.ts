import { createProviderStoppedBoundary } from "@paperclipai/adapter-utils/provider-stopped-boundary";
import { createUsageCheckpointLog } from "@paperclipai/adapter-utils/usage-checkpoint";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  buildPaperclipEnv,
  buildInvocationEnvForLogs,
  ensureAbsoluteDirectory,
  joinPromptSections,
  parseObject,
  renderTemplate,
  hydrateFreshSessionHandoff,
  selectPaperclipPromptSections,
  selectInitialCommunicationGuidance,
  isPaperclipRecoveryWakePayload,
  DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE,
} from "@paperclipai/adapter-utils/server-utils";
import {
  runAdapterExecutionTargetProcess,
  resolveAdapterExecutionTargetCommandForLogs,
  readAdapterExecutionTarget,
} from "@paperclipai/adapter-utils/execution-target";
import { DEFAULT_ANTIGRAVITY_LOCAL_MODEL, resolveAntigravityModel } from "../index.js";
import {
  parseAntigravityStreamJson,
  createAntigravityStreamParser,
  isAntigravityRateLimited,
  detectAntigravityAuthRequired,
  extractAntigravityResetTime,
  isAntigravitySessionUnrecoverable,
  describeAntigravityFailure,
} from "./parse.js";
import { recordAntigravityRunUsage } from "./quota.js";

function buildHeadlessEnv(env: Record<string, string>): Record<string, string> {
  const next = { ...env };
  const term = env.TERM?.trim().toLowerCase();
  if (!term || term === "dumb" || term === "vt100") {
    next.TERM = "xterm-256color";
  }
  if (!next.COLORTERM?.trim()) {
    next.COLORTERM = "truecolor";
  }
  next.NO_BROWSER = "1";
  return next;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const {
    runId,
    agent,
    runtime,
    context,
    onLog,
    onMeta,
    onSpawn,
  } = ctx;

  const config = parseObject(ctx.config);
  const providerStop = createProviderStoppedBoundary();

  const command = asString(config.command, "agy").trim() || "agy";
  const model = resolveAntigravityModel(config.model, process.env as Record<string, unknown>);
  const effort = asString(config.effort, "").trim();
  const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, true);
  const accountProfile = asString(config.accountProfile, "").trim();

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 15);

  const rawCwd = asString(config.cwd, "").trim() || process.cwd();
  const cwd = path.resolve(rawCwd);
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...buildPaperclipEnv(agent),
  };
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }

  // Account isolation: if accountProfile or custom credentials dir is specified
  if (accountProfile) {
    const profileHome = path.join(os.homedir(), ".paperclip", "credentials", "antigravity", accountProfile);
    try {
      await fs.mkdir(profileHome, { recursive: true });
      env.HOME = profileHome;
    } catch {
      // Keep default HOME if creation fails
    }
  }

  const executionTarget = readAdapterExecutionTarget(ctx);
  const resolvedCommand = await resolveAdapterExecutionTargetCommandForLogs(command, executionTarget, cwd, env);

  const extraArgs = asStringArray(config.extraArgs);
  const promptTemplate = asString(config.promptTemplate, DEFAULT_PAPERCLIP_AGENT_PROMPT_TEMPLATE);

  let instructionsPrefix = "";
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  if (instructionsFilePath) {
    try {
      const content = await fs.readFile(instructionsFilePath, "utf8");
      if (content.trim()) {
        instructionsPrefix = `# Instructions from ${instructionsFilePath}\n\n${content.trim()}\n\n`;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog("stdout", `[paperclip] Warning: could not read instructions file "${instructionsFilePath}": ${reason}\n`);
    }
  }

  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };

  const buildPrompt = (resumedSession: boolean) => {
    const { taskContextNote, wakePrompt } = selectPaperclipPromptSections(context, {
      resumedSession,
      includeCommunicationGuidance: false,
    });
    const renderedPrompt = isPaperclipRecoveryWakePayload(context.paperclipWake)
      ? ""
      : renderTemplate(promptTemplate, templateData);
    const sessionHandoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();

    return joinPromptSections([
      instructionsPrefix,
      wakePrompt,
      taskContextNote,
      sessionHandoffNote,
      renderedPrompt,
    ]);
  };

  const buildArgs = (resumeSessionId: string | null, prompt: string) => {
    const args = ["-p", prompt, "--output-format", "stream-json"];
    if (dangerouslySkipPermissions) {
      args.push("--dangerously-skip-permissions");
    }
    if (resumeSessionId) {
      args.push("--conversation", resumeSessionId);
    }
    if (model && model !== DEFAULT_ANTIGRAVITY_LOCAL_MODEL) {
      args.push("--model", model);
    }
    if (effort) {
      args.push("--effort", effort);
    }
    if (extraArgs.length > 0) {
      args.push(...extraArgs);
    }
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    await hydrateFreshSessionHandoff(ctx, { resumedSession: Boolean(resumeSessionId) });
    const prompt = joinPromptSections([
      selectInitialCommunicationGuidance(context, { resumedSession: Boolean(resumeSessionId) }),
      buildPrompt(Boolean(resumeSessionId)),
    ]);

    const args = buildArgs(resumeSessionId, prompt);
    const invocationEnv = buildHeadlessEnv(env);

    if (onMeta) {
      await onMeta({
        adapterType: "antigravity_local",
        command: resolvedCommand,
        cwd,
        commandNotes: [
          "Prompt is passed via agy -p with --output-format stream-json.",
          dangerouslySkipPermissions ? "Tool approval auto-granted via --dangerously-skip-permissions." : "",
          resumeSessionId ? `Resuming conversation ${resumeSessionId}.` : "Starting fresh conversation.",
        ].filter(Boolean),
        commandArgs: args.map((v, i) => (v === prompt ? `<prompt ${prompt.length} chars>` : v)),
        env: buildInvocationEnvForLogs(invocationEnv, { resolvedCommand }),
        prompt,
        context,
      });
    }

    const consumeAccounting = createAntigravityStreamParser();
    const accountingLog = createUsageCheckpointLog(onLog, ctx.onUsage, (stdout) => {
      const parsed = consumeAccounting(stdout);
      return {
        usage: parsed.usage,
        costUsd: parsed.costUsd,
        usageBasis: "per_run",
        provider: "antigravity",
        biller: "google",
        billingType: "subscription",
        model,
        complete: parsed.status !== null,
      };
    });

    const proc = await runAdapterExecutionTargetProcess(runId, executionTarget, command, args, {
      onProcessStopped: providerStop.beginInvocation(),
      cwd,
      env: invocationEnv,
      timeoutSec,
      graceSec,
      onSpawn,
      onRuntimeProgress: ctx.onRuntimeProgress,
      onLog: accountingLog,
    });
    await accountingLog.flush();

    return {
      proc,
      parsed: parseAntigravityStreamJson(proc.stdout),
    };
  };

  const initialResumeId = runtime?.sessionId ?? null;
  let attempt = await runAttempt(initialResumeId);

  // If conversation was not found or unrecoverable, retry once fresh
  if (initialResumeId && isAntigravitySessionUnrecoverable(attempt.proc.stdout, attempt.proc.stderr)) {
    await onLog(
      "stderr",
      `[paperclip] Conversation "${initialResumeId}" not found or expired; retrying with fresh session.\n`,
    );
    attempt = await runAttempt(null);
  }

  // Record token and run usage for 5h/7d quota meters
  const accountKey = accountProfile || "default";
  recordAntigravityRunUsage(accountKey, attempt.parsed.usage, attempt.proc.exitCode === 0);

  const rateLimited = isAntigravityRateLimited(attempt.proc.stdout, attempt.proc.stderr);
  const authRequired = detectAntigravityAuthRequired(attempt.proc.stdout, attempt.proc.stderr);
  const resolvedSessionId = attempt.parsed.sessionId ?? initialResumeId;

  if (attempt.proc.timedOut) {
    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: true,
      usage: attempt.parsed.usage,
      provider: "antigravity",
      biller: "google",
      model,
      billingType: "subscription",
      errorMessage: `Timed out after ${timeoutSec}s`,
      errorCode: rateLimited ? "rate_limited" : authRequired ? "authentication_required" : null,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionId ? { sessionId: resolvedSessionId, cwd } : null,
    };
  }

  const success = attempt.proc.exitCode === 0 && attempt.parsed.status !== "ERROR";
  const errorMessage = success
    ? undefined
    : describeAntigravityFailure(attempt.proc);

  return {
    exitCode: attempt.proc.exitCode,
    signal: attempt.proc.signal,
    timedOut: false,
    summary: attempt.parsed.summary,
    usage: attempt.parsed.usage,
    provider: "antigravity",
    biller: "google",
    model,
    billingType: "subscription",
    costUsd: attempt.parsed.costUsd ?? undefined,
    errorMessage,
    errorCode: rateLimited ? "rate_limited" : authRequired ? "authentication_required" : undefined,
    sessionId: resolvedSessionId,
    sessionParams: resolvedSessionId ? { sessionId: resolvedSessionId, cwd } : null,
  };
}
