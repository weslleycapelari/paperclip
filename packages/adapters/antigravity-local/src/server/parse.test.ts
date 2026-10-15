import { describe, it, expect } from "vitest";
import {
  parseAntigravityStreamJson,
  isAntigravityRateLimited,
  detectAntigravityAuthRequired,
  extractAntigravityResetTime,
} from "./parse.js";

describe("parseAntigravityStreamJson", () => {
  it("parses init, step_update, and result events from agy stream-json", () => {
    const stream = [
      '{"event":"init","conversation_id":"1c039a14-ea9b-429f-9387-22bf3d19f844","init":{"cwd":"/home/weslley/paperclip","tools":["write_to_file"],"permission_mode":"always-proceed"}}',
      '{"event":"step_update","step_update":{"conversation_id":"1c039a14-ea9b-429f-9387-22bf3d19f844","step_index":0,"state":"DONE","step_type":"user_input"}}',
      '{"event":"step_update","step_update":{"conversation_id":"1c039a14-ea9b-429f-9387-22bf3d19f844","step_index":1,"state":"ACTIVE","step_type":"agent_response","text_delta":"Hello world"}}',
      '{"event":"step_update","step_update":{"conversation_id":"1c039a14-ea9b-429f-9387-22bf3d19f844","step_index":1,"state":"DONE","step_type":"agent_response","text_delta":"!\\n","duration_seconds":1.2,"usage":{"input_tokens":1500,"output_tokens":20,"thinking_tokens":10,"cache_read_tokens":500,"total_tokens":2020}}}',
      '{"event":"result","result":{"conversation_id":"1c039a14-ea9b-429f-9387-22bf3d19f844","status":"SUCCESS","response":"Hello world!\\n","duration_seconds":1.5,"num_turns":1,"usage":{"input_tokens":1500,"output_tokens":20,"thinking_tokens":10,"cache_read_tokens":500,"total_tokens":2020}}}'
    ].join("\n");

    const parsed = parseAntigravityStreamJson(stream);
    expect(parsed.sessionId).toBe("1c039a14-ea9b-429f-9387-22bf3d19f844");
    expect(parsed.summary).toBe("Hello world!");
    expect(parsed.status).toBe("SUCCESS");
    expect(parsed.usage.inputTokens).toBe(1500);
    expect(parsed.usage.outputTokens).toBe(20);
    expect(parsed.usage.cachedInputTokens).toBe(500);
    expect(parsed.errorMessage).toBeNull();
  });

  it("detects rate limits and quota exceeded errors", () => {
    const errorOutput = "Error: 429 Too Many Requests: usage limit reached, resets at 19:00 UTC";
    expect(isAntigravityRateLimited(errorOutput, "")).toBe(true);
    expect(extractAntigravityResetTime(errorOutput, "")).toBe("19:00 UTC");
  });

  it("detects authentication requirements", () => {
    const authError = "Authentication failed: invalid token, please log in";
    expect(detectAntigravityAuthRequired(authError, "")).toBe(true);
  });
});
