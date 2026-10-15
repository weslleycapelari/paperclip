import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";
import type { UsageSummary } from "@paperclipai/adapter-utils";

const ANTIGRAVITY_RATE_LIMIT_RE =
  /(?:rate[-\s]?limit(?:ed)?|too\s+many\s+requests|\b429\b|quota\s+exceeded|usage\s+limit\s+reached|5[-\s]?hour\s+limit\s+reached|weekly\s+limit\s+reached|session\s+limit\s+(?:reached|exceeded)|out\s+of\s+quota|capacity\s+exceeded|resource_exhausted)/i;

const ANTIGRAVITY_AUTH_ERROR_RE =
  /(?:not\s+logged\s+in|please\s+log\s+in|login\s+required|requires\s+login|unauthorized|\b401\b|authentication\s+failed|invalid\s+(?:oauth\s+)?token|token\s+expired|refresh_token)/i;

const ANTIGRAVITY_RESET_TIME_RE =
  /(?:resets?\s+(?:at\s+|in\s+)?([^\n()]+?)(?:\s*\(([^)]+)\))?)(?:[.!]|\n|$)/i;

export interface AntigravityParseResult {
  sessionId: string | null;
  summary: string;
  usage: UsageSummary;
  costUsd: number | null;
  errorMessage: string | null;
  status: "SUCCESS" | "ERROR" | "ACTIVE" | null;
}

export function createAntigravityStreamParser() {
  let sessionId: string | null = null;
  const assistantTexts: string[] = [];
  let finalResponse = "";
  let errorMessage: string | null = null;
  let status: "SUCCESS" | "ERROR" | "ACTIVE" | null = null;
  const usage: UsageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
  };

  return (stdout: string): AntigravityParseResult => {
    for (const rawLine of stdout.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const event = parseJson(line);
      if (!event) continue;

      const eventType = asString(event.event, "").trim();

      // Init event: {"event":"init","conversation_id":"...","init":{...}}
      if (eventType === "init" || event.conversation_id) {
        const convId = asString(event.conversation_id, "").trim();
        if (convId) sessionId = convId;
      }

      // Step update event: {"event":"step_update","step_update":{...}}
      if (eventType === "step_update") {
        const step = parseObject(event.step_update);
        const convId = asString(step.conversation_id, "").trim();
        if (convId) sessionId = convId;

        const stepType = asString(step.step_type, "").trim();
        const delta = asString(step.text_delta, "");
        if (stepType === "agent_response" && delta) {
          assistantTexts.push(delta);
        }

        const stepUsage = parseObject(step.usage);
        if (Object.keys(stepUsage).length > 0) {
          usage.inputTokens = Math.max(usage.inputTokens, asNumber(stepUsage.input_tokens, 0));
          usage.outputTokens = Math.max(usage.outputTokens, asNumber(stepUsage.output_tokens, 0));
          usage.cachedInputTokens = Math.max(usage.cachedInputTokens ?? 0, asNumber(stepUsage.cache_read_tokens, 0));
        }
        continue;
      }

      // Result event: {"event":"result","result":{"status":"SUCCESS", "response":"...", "usage":{...}}}
      if (eventType === "result") {
        const res = parseObject(event.result);
        const convId = asString(res.conversation_id, "").trim();
        if (convId) sessionId = convId;

        const resStatus = asString(res.status, "").toUpperCase();
        if (resStatus === "SUCCESS" || resStatus === "ERROR") {
          status = resStatus as "SUCCESS" | "ERROR";
        }

        const resp = asString(res.response, "");
        if (resp) finalResponse = resp;

        const err = asString(res.error, "") || asString(res.message, "");
        if (err || resStatus === "ERROR") {
          errorMessage = err || "Execution failed";
        }

        const resUsage = parseObject(res.usage);
        if (Object.keys(resUsage).length > 0) {
          usage.inputTokens = Math.max(usage.inputTokens, asNumber(resUsage.input_tokens, 0));
          usage.outputTokens = Math.max(usage.outputTokens, asNumber(resUsage.output_tokens, 0));
          usage.cachedInputTokens = Math.max(usage.cachedInputTokens ?? 0, asNumber(resUsage.cache_read_tokens, 0));
        }
        continue;
      }

      // Error event: {"event":"error", ...}
      if (eventType === "error") {
        const errObj = parseObject(event.error);
        const msg = asString(errObj.message, "") || asString(event.message, "") || "Antigravity error";
        errorMessage = msg;
        status = "ERROR";
        continue;
      }
    }

    const summary = (finalResponse || assistantTexts.join("")).trim();

    return {
      sessionId,
      summary,
      usage: { ...usage },
      costUsd: null,
      errorMessage,
      status,
    };
  };
}

export function parseAntigravityStreamJson(stdout: string): AntigravityParseResult {
  return createAntigravityStreamParser()(stdout);
}

export function isAntigravityRateLimited(stdout: string, stderr: string): boolean {
  return ANTIGRAVITY_RATE_LIMIT_RE.test(`${stdout}\n${stderr}`);
}

export function detectAntigravityAuthRequired(stdout: string, stderr: string): boolean {
  return ANTIGRAVITY_AUTH_ERROR_RE.test(`${stdout}\n${stderr}`);
}

export function extractAntigravityResetTime(stdout: string, stderr: string): string | null {
  const match = `${stdout}\n${stderr}`.match(ANTIGRAVITY_RESET_TIME_RE);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export function isAntigravitySessionUnrecoverable(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`.toLowerCase();
  return (
    haystack.includes("conversation not found") ||
    haystack.includes("unknown conversation") ||
    haystack.includes("invalid conversation id") ||
    haystack.includes("session corrupted")
  );
}

export function describeAntigravityFailure(proc: {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}): string {
  const stderrLine = proc.stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (stderrLine) return `Antigravity CLI failed: ${stderrLine}`;

  const parsed = parseAntigravityStreamJson(proc.stdout);
  if (parsed.errorMessage) return parsed.errorMessage;

  if (proc.exitCode !== null && proc.exitCode !== 0) {
    return `Antigravity CLI exited with code ${proc.exitCode}`;
  }

  return "Antigravity run completed without result";
}
