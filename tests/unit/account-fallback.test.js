import { describe, expect, it } from "vitest";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

describe("accountFallback", () => {
  it("uses a long cooldown for Kiro suspicious activity limits", () => {
    const result = checkFallbackError(
      429,
      "Due to suspicious activity, we are imposing temporary limits on how frequently you can use this service"
    );

    expect(result.shouldFallback).toBe(true);
    expect(result.cooldownMs).toBe(30 * 60 * 1000);
    expect(result.newBackoffLevel).toBeUndefined();
  });
});
