import { describe, expect, it } from "vitest";
import { buildKiroPayload, trimKiroPayload } from "../../open-sse/translator/request/openai-to-kiro.js";

describe("openai-to-kiro", () => {
  it("trims oversized Kiro payloads by dropping old history", () => {
    const payload = buildKiroPayload("claude-sonnet-4.5", {
      messages: [
        { role: "user", content: "old user ".repeat(20000) },
        { role: "assistant", content: "old assistant ".repeat(20000) },
        { role: "user", content: "current request" },
      ],
    });

    const trimmed = trimKiroPayload(payload, 20000);
    expect(JSON.stringify(trimmed).length).toBeLessThanOrEqual(20000);
    expect(trimmed.conversationState.currentMessage.userInputMessage.content).toContain("current request");
  });

  it("truncates the current message when there is no history left", () => {
    const payload = buildKiroPayload("claude-sonnet-4.5", {
      messages: [
        { role: "user", content: "current ".repeat(30000) },
      ],
    });

    const trimmed = trimKiroPayload(payload, 20000);
    expect(JSON.stringify(trimmed).length).toBeLessThanOrEqual(22000);
    expect(trimmed.conversationState.currentMessage.userInputMessage.content).toContain("9router: older context was truncated");
  });
});
