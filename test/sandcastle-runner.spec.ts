import { describe, expect, it } from "vitest";
import { sandboxSecrets, stepFromStreamEvent } from "../src/factory/sandcastle.runner.js";

describe("sandboxSecrets", () => {
  it("prefers the Max subscription token and exposes FACTORY_GH_TOKEN to gh as GH_TOKEN", () => {
    expect(sandboxSecrets({ CLAUDE_CODE_OAUTH_TOKEN: "oat", ANTHROPIC_API_KEY: "key", FACTORY_GH_TOKEN: "ghp" })).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: "oat",
      GH_TOKEN: "ghp",
    });
    expect(sandboxSecrets({ ANTHROPIC_API_KEY: "key", GH_TOKEN: "host-token" })).toEqual({ ANTHROPIC_API_KEY: "key" });
  });
});

describe("stepFromStreamEvent", () => {
  const timestamp = new Date("2026-11-23T06:00:00Z");

  it("turns tool calls and prose into steps and drops raw stdout", () => {
    expect(stepFromStreamEvent("implement", { type: "toolCall", name: "Bash", formattedArgs: "npm test", iteration: 1, timestamp })).toEqual({
      phase: "implement",
      kind: "tool",
      text: "Bash(npm test)",
      at: timestamp,
    });
    expect(stepFromStreamEvent("review", { type: "text", message: "Todo pasa", iteration: 1, timestamp })).toMatchObject({ kind: "text", text: "Todo pasa" });
    expect(stepFromStreamEvent("implement", { type: "raw", line: "{}", iteration: 1, timestamp })).toBeNull();
  });
});
