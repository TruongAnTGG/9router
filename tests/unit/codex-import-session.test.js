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
      sessionToken: "encrypted-session-token",
      importMode: "chatgpt_session_access_token",
    });
  });

  it("rejects a browser session cookie without usable token material", () => {
    expect(() => normalizeCodexImport({
      session: "__Secure-next-auth.session-token=secret",
    })).toThrow("ChatGPT browser cookies cannot be imported");
  });

  it("normalizes a Codex auth bundle exported from ChatGPT account data", () => {
    const accessToken = makeJwt({
      exp: 1780627883,
      "https://api.openai.com/auth": {
        chatgpt_account_id: "account-from-access",
        chatgpt_plan_type: "free",
      },
      "https://api.openai.com/profile": {
        email: "access@example.com",
      },
    });
    const idToken = makeJwt({
      email: "id@example.com",
      "https://api.openai.com/auth": {
        chatgpt_account_id: "account-from-id",
        chatgpt_plan_type: "free",
      },
    });

    const result = normalizeCodexImport({
      type: "codex",
      account_id: "79a67681-edd0-499b-b4fa-103cbba1acba",
      chatgpt_account_id: "79a67681-edd0-499b-b4fa-103cbba1acba",
      email: "codex@example.com",
      name: "codex@example.com",
      plan_type: "free",
      chatgpt_plan_type: "free",
      id_token: idToken,
      access_token: accessToken,
      refresh_token: "",
      session_token: "encrypted-session-token",
      last_refresh: "2026-05-26T02:53:42.052912+00:00",
      expired: "2026-06-05T02:51:23+00:00",
      id_token_synthetic: true,
    });

    expect(result.provider).toBe("codex");
    expect(result.authType).toBe("oauth");
    expect(result.testStatus).toBe("active");
    expect(result.accessToken).toBe(accessToken);
    expect(result.refreshToken).toBeUndefined();
    expect(result.email).toBe("codex@example.com");
    expect(result.expiresAt).toBe("2026-06-05T02:51:23.000Z");
    expect(result.providerSpecificData).toEqual({
      chatgptAccountId: "79a67681-edd0-499b-b4fa-103cbba1acba",
      chatgptPlanType: "free",
      sessionToken: "encrypted-session-token",
      idTokenSynthetic: true,
      importMode: "chatgpt_session_access_token",
    });
  });

  it("normalizes an already-shaped Codex account session for DB import", () => {
    const accessToken = makeJwt({
      exp: 1780634967,
      "https://api.openai.com/auth": {
        chatgpt_account_id: "account-from-access",
        chatgpt_plan_type: "free",
      },
      "https://api.openai.com/profile": {
        email: "access@example.com",
      },
    });

    const result = normalizeCodexImport({
      accessToken,
      refreshToken: "refresh",
      expiresAt: "2026-06-05T04:49:27.017Z",
      testStatus: "active",
      expiresIn: 864000,
      providerSpecificData: {
        chatgptAccountId: "account-from-provider-data",
        chatgptPlanType: "free",
      },
      id: "existing-id",
      provider: "codex",
      authType: "oauth",
      name: "codex@example.com",
      email: "codex@example.com",
      priority: 3,
      isActive: true,
      createdAt: "2026-05-26T04:49:27.017Z",
      updatedAt: "2026-05-26T04:49:27.017Z",
    });

    expect(result).toMatchObject({
      provider: "codex",
      authType: "oauth",
      accessToken,
      refreshToken: "refresh",
      expiresAt: "2026-06-05T04:49:27.017Z",
      testStatus: "active",
      expiresIn: 864000,
      name: "codex@example.com",
      email: "codex@example.com",
      priority: 3,
      isActive: true,
      providerSpecificData: {
        chatgptAccountId: "account-from-provider-data",
        chatgptPlanType: "free",
      },
    });
  });
});
