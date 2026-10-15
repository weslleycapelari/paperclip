import pc from "picocolors";

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

export function printAntigravityStreamEvent(raw: string, _debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const eventType = asString(parsed.event).trim();

  if (eventType === "init") {
    const convId = asString(parsed.conversation_id);
    console.log(pc.cyan(`Antigravity init [conversation: ${convId}]`));
    return;
  }

  if (eventType === "step_update") {
    const step = asRecord(parsed.step_update);
    if (!step) return;

    const stepType = asString(step.step_type).trim();
    if (stepType === "agent_response") {
      const delta = asString(step.text_delta);
      if (delta) process.stdout.write(pc.green(delta));
      return;
    }

    if (stepType === "tool_call") {
      const name = asString(step.tool_name, asString(step.tool, "tool"));
      console.log(pc.yellow(`\ntool_call: ${name}`));
      return;
    }

    if (stepType === "tool_result") {
      const isError = step.is_error === true || asString(step.state).toLowerCase() === "error";
      console.log((isError ? pc.red : pc.cyan)(`tool_result${isError ? " (error)" : ""}`));
      return;
    }

    return;
  }

  if (eventType === "result") {
    const res = asRecord(parsed.result) ?? {};
    const usage = asRecord(res.usage) ?? {};
    const input = asNumber(usage.input_tokens);
    const output = asNumber(usage.output_tokens);
    const cached = asNumber(usage.cache_read_tokens);
    const status = asString(res.status).toUpperCase();

    console.log(pc.blue(`\nAntigravity finished: status=${status} tokens: in=${input} out=${output} cached=${cached}`));
    return;
  }

  if (eventType === "error") {
    const errObj = asRecord(parsed.error);
    const text = asString(errObj?.message, asString(parsed.message, "Error"));
    console.log(pc.red(`Antigravity error: ${text}`));
    return;
  }

  console.log(line);
}
