export const type = "antigravity_local";
export const label = "Antigravity CLI";

export const DEFAULT_ANTIGRAVITY_LOCAL_MODEL = "inherit";

export function resolveAntigravityModel(
  model: unknown,
  env: Record<string, unknown> = {},
): string {
  const configured = typeof model === "string" ? model.trim() : "";
  if (configured) return configured;
  const envModel = typeof env.ANTIGRAVITY_MODEL === "string" ? env.ANTIGRAVITY_MODEL.trim() : "";
  if (envModel) return envModel;
  return DEFAULT_ANTIGRAVITY_LOCAL_MODEL;
}

export const models = [
  { id: "inherit", label: "Auto (Inherit)" },
  { id: "pro", label: "Antigravity Pro (Claude Opus 5.5 / Gemini 3.1 Pro)" },
  { id: "flash", label: "Antigravity Flash (Gemini 3.8 Flash)" },
  { id: "flash_lite", label: "Antigravity Flash Lite (Gemini 3.5 Flash Lite)" },
  { id: "claude-opus-5-5-high", label: "Claude Opus 5.5 (High)" },
  { id: "claude-sonnet-5-5-high", label: "Claude Sonnet 5.5 (High)" },
  { id: "gemini-3.8-flash-high", label: "Gemini 3.8 Flash (High)" },
  { id: "gemini-3.8-flash-medium", label: "Gemini 3.8 Flash (Medium)" },
  { id: "gpt-oss-120b-medium", label: "GPT-OSS 120B (Medium)" },
];

export const SANDBOX_INSTALL_COMMAND = "which agy || echo 'Antigravity CLI (agy) required'";

export const agentConfigurationDoc = `# antigravity_local agent configuration

Adapter: antigravity_local

Use when:
- You want Paperclip to run the Antigravity CLI (\`agy\`) locally on the host machine
- You want Antigravity sessions resumed across heartbeats with --conversation <id>
- You want seamless tool approval via --dangerously-skip-permissions
- You want multi-account pooling and rotation between subscription profiles

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process
- instructionsFilePath (string, optional): absolute path to markdown instructions file prepended to prompt
- promptTemplate (string, optional): run prompt template
- model (string, optional): model id (e.g. inherit, pro, flash, flash_lite, claude-opus-5-5-high). Defaults to inherit.
- effort (string, optional): reasoning effort (low|medium|high|xhigh|max)
- command (string, optional): defaults to "agy"
- accountProfile (string, optional): profile key for multi-account pool routing (e.g. "account-1", "account-2")
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (0 = wait until completion)
- graceSec (number, optional): SIGTERM grace period in seconds (default 15)

Notes:
- Runs use \`agy -p <prompt> --output-format stream-json --dangerously-skip-permissions\`.
- Sessions resume with \`--conversation <id>\` matching stored session ID.
- Usage tracking accounts for tokens and rolling windows (5-hour session and 7-day weekly limits).
`;
