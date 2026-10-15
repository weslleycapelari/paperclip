import type { TranscriptEntry } from "@paperclipai/adapter-utils";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseAntigravityStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const eventType = asString(parsed.event).trim();

  if (eventType === "init") {
    const sessionId = asString(parsed.conversation_id);
    return [{ kind: "init", ts, model: "antigravity", sessionId }];
  }

  if (eventType === "step_update") {
    const step = asRecord(parsed.step_update);
    if (!step) return [];

    const stepType = asString(step.step_type).trim();
    if (stepType === "agent_response") {
      const text = asString(step.text_delta).trim();
      return text ? [{ kind: "assistant", ts, text }] : [];
    }

    if (stepType === "tool_call") {
      const name = asString(step.tool_name, asString(step.tool, "tool"));
      return [{
        kind: "tool_call",
        ts,
        name,
        input: step.input ?? step.arguments ?? {},
      }];
    }

    if (stepType === "tool_result") {
      const isError = step.is_error === true || asString(step.state).toLowerCase() === "error";
      return [{
        kind: "tool_result",
        ts,
        toolUseId: asString(step.call_id, "tool_result"),
        content: asString(step.output, asString(step.result, "")),
        isError,
      }];
    }

    if (stepType === "system_message") {
      const text = asString(step.text, asString(step.message, ""));
      return text ? [{ kind: "system", ts, text }] : [];
    }

    return [];
  }

  if (eventType === "result") {
    const res = asRecord(parsed.result) ?? {};
    const usage = asRecord(res.usage) ?? {};
    const isError = asString(res.status).toUpperCase() === "ERROR";
    const text = asString(res.response, asString(res.error, ""));

    return [{
      kind: "result",
      ts,
      text,
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens),
      cachedTokens: asNumber(usage.cache_read_tokens),
      costUsd: 0,
      subtype: "result",
      isError,
      errors: isError && text ? [text] : [],
    }];
  }

  if (eventType === "error") {
    const errObj = asRecord(parsed.error);
    const text = asString(errObj?.message, asString(parsed.message, "Error"));
    return [{ kind: "stderr", ts, text }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
