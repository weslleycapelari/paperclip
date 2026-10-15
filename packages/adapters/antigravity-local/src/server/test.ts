import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

const execFileAsync = promisify(execFile);

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = parseObject(ctx.config);
  const command = asString(config.command, "agy").trim() || "agy";
  const checks: AdapterEnvironmentCheck[] = [];

  try {
    const { stdout } = await execFileAsync("which", [command], { timeout: 5000 });
    const binaryPath = stdout.trim();
    if (binaryPath) {
      checks.push({
        code: "command",
        level: "info",
        message: `Antigravity CLI located at ${binaryPath}`,
      });
    } else {
      checks.push({
        code: "command",
        level: "error",
        message: `Command "${command}" not found in PATH`,
      });
    }
  } catch {
    checks.push({
      code: "command",
      level: "error",
      message: `Antigravity CLI command "${command}" not found. Ensure agy is installed.`,
    });
  }

  return {
    adapterType: "antigravity_local",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
