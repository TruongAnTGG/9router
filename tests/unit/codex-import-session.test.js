import { describe, expect, it } from "vitest";
import { normalizeCodexImport } from "../../src/lib/oauth/codexImport.js";

function makeJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.sig`;
}

describe("normalizeCodexImport", () => {
  it("normalizes a persistent Codex OAuth token bundle", () => {
    const result = normalizeCodexImport({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      id_token: makeJwt({
        email: "dev@example.com",
        "https://api.openai.com/auth": {
          chatgpt_account_id: "account-1",
          chatgpt_plan_type: "plus",
        },
      }),
    });

    expect(result.provider).toBe("codex");
    expect(result.authType).toBe("oauth");
    expect(result.accessToken).toBe("access");
    expect(result.refreshToken).toBe("refresh");
    expect(result.email).toBe("dev@example.com");
    expect(result.providerSpecificData).toEqual({
      chatgptAccountId: "account-1",
      chatgptPlanType: "plus",
    });
    expect(result.expiresAt).toBeTruthy();
  });

  it("imports a ChatGPT session export as access-only Codex credentials", () => {
    const accessToken = makeJwt({
      exp: 1780627883,
      "https://api.openai.com/auth": {
        chatgpt_account_id: "account-2",
        chatgpt_plan_type: "free",
      },
      "https://api.openai.com/profile": {
        email: "chatgpt@example.com",
      },
    });

    const result = normalizeCodexImport({
      user: { email: "fallback@example.com" },
      account: { id: "account-from-session", planType: "free" },
      accessToken,
      sessionToken: "encrypted-session-token",
      authProvider: "openai",
    });

    expect(result.accessToken).toBe(accessToken);
    expect(result.refreshToken).toBeUndefined();
    expect(result.email).toBe("fallback@example.com");
    expect(result.expiresAt).toBe("2026-06-05T02:51:23.000Z");
    expect(result.providerSpecificData).toEqual({
      chatgptAccountId: "account-from-session",
      chatgptPlanType: "free",
      importMode: "chatgpt_session_access_token",
    });
  });

  it("rejects a browser session cookie without usable token material", () => {
    expect(() => normalizeCodexImport({
      session: "__Secure-next-auth.session-token=secret",
    })).toThrow("ChatGPT browser cookies cannot be imported");
  });
});
