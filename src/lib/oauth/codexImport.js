const BASE64_BLOCK_SIZE = 4;

function decodeJwtPayload(jwt) {
  try {
    if (!jwt || typeof jwt !== "string") return null;
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const missingPadding = (BASE64_BLOCK_SIZE - (base64.length % BASE64_BLOCK_SIZE)) % BASE64_BLOCK_SIZE;
    return JSON.parse(Buffer.from(base64 + "=".repeat(missingPadding), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function parseJsonMaybe(value, fieldName) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a JSON object or JSON string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
    } catch {
      throw new Error(`${fieldName} is not valid JSON`);
    }
  }
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return undefined;
}

function looksLikeChatGptCookie(value) {
  if (typeof value !== "string") return false;
  return (
    value.includes("__Secure-next-auth.session-token") ||
    value.includes("next-auth.session-token") ||
    value.includes("oai-did=") ||
    value.includes("cf_clearance=")
  );
}

function extractOpenAiJwtAccountInfo(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return {};
  const auth = payload["https://api.openai.com/auth"] || {};
  const profile = payload["https://api.openai.com/profile"] || {};
  return {
    email: profile.email || payload.email,
    expiresAt: typeof payload.exp === "number" ? new Date(payload.exp * 1000).toISOString() : undefined,
    chatgptAccountId: auth.chatgpt_account_id,
    chatgptPlanType: auth.chatgpt_plan_type,
  };
}

function extractCodexAccountInfo(idToken) {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return {};
  const auth = payload["https://api.openai.com/auth"] || {};
  return {
    email: payload.email,
    chatgptAccountId: auth.chatgpt_account_id,
    chatgptPlanType: auth.chatgpt_plan_type,
  };
}

function extractTokenSource(input) {
  const direct = input?.tokens || input?.tokenResponse || input?.token_response || input?.codexAuth;
  const parsedDirect = parseJsonMaybe(direct, "tokens");
  if (parsedDirect) return parsedDirect;

  const session = input?.session || input?.sessionJson || input?.session_json;
  if (looksLikeChatGptCookie(session)) {
    throw new Error("ChatGPT browser cookies cannot be imported as Codex OAuth credentials. Paste a Codex OAuth token JSON that includes refresh_token instead.");
  }

  const parsedSession = parseJsonMaybe(session, "session");
  if (parsedSession) return parsedSession;

  return input || {};
}

/**
 * Normalize a Codex/OpenAI OAuth token bundle into the provider connection shape.
 * A refresh_token creates a normal persistent Codex connection. A ChatGPT session
 * export that only has accessToken is imported as access-only and will not refresh.
 */
export function normalizeCodexImport(input = {}) {
  const source = extractTokenSource(input);
  const nestedTokens = source.tokens || source.oauth || source.auth || {};

  const accessToken = pickString(
    input.accessToken,
    input.access_token,
    source.accessToken,
    source.access_token,
    nestedTokens.accessToken,
    nestedTokens.access_token
  );
  const refreshToken = pickString(
    input.refreshToken,
    input.refresh_token,
    source.refreshToken,
    source.refresh_token,
    nestedTokens.refreshToken,
    nestedTokens.refresh_token
  );
  const idToken = pickString(
    input.idToken,
    input.id_token,
    source.idToken,
    source.id_token,
    nestedTokens.idToken,
    nestedTokens.id_token
  );

  if (!refreshToken && !accessToken) {
    throw new Error("Missing accessToken or refresh_token. A ChatGPT browser cookie alone cannot be converted to a Codex connection.");
  }

  const accountInfo = extractCodexAccountInfo(idToken);
  const accessInfo = extractOpenAiJwtAccountInfo(accessToken);
  const email = pickString(
    input.email,
    source.email,
    source.user?.email,
    nestedTokens.email,
    accountInfo.email,
    accessInfo.email
  );
  const name = pickString(input.name, input.displayName, source.name, source.displayName, email);
  const priority = pickNumber(input.priority, source.priority);
  const isActive = pickBoolean(input.isActive, input.is_active, source.isActive, source.is_active);
  const expiresIn = pickNumber(input.expiresIn, input.expires_in, source.expiresIn, source.expires_in, nestedTokens.expiresIn, nestedTokens.expires_in);
  const explicitExpiresAt = pickString(
    input.expiresAt,
    input.expires_at,
    input.expired,
    source.expiresAt,
    source.expires_at,
    source.expires,
    source.expired,
    nestedTokens.expiresAt,
    nestedTokens.expires_at,
    nestedTokens.expired
  );
  const tokenType = pickString(input.tokenType, input.token_type, source.tokenType, source.token_type, nestedTokens.tokenType, nestedTokens.token_type);
  const scope = pickString(input.scope, source.scope, nestedTokens.scope);
  const chatgptAccountId = pickString(
    input.chatgptAccountId,
    input.account_id,
    input.providerSpecificData?.chatgptAccountId,
    input.providerSpecificData?.chatgpt_account_id,
    source.chatgptAccountId,
    source.chatgpt_account_id,
    source.account_id,
    source.providerSpecificData?.chatgptAccountId,
    source.providerSpecificData?.chatgpt_account_id,
    nestedTokens.chatgptAccountId,
    nestedTokens.chatgpt_account_id,
    nestedTokens.account_id,
    accountInfo.chatgptAccountId,
    source.account?.id,
    accessInfo.chatgptAccountId
  );
  const chatgptPlanType = pickString(
    input.chatgptPlanType,
    input.plan_type,
    input.providerSpecificData?.chatgptPlanType,
    input.providerSpecificData?.chatgpt_plan_type,
    source.chatgptPlanType,
    source.chatgpt_plan_type,
    source.plan_type,
    source.providerSpecificData?.chatgptPlanType,
    source.providerSpecificData?.chatgpt_plan_type,
    nestedTokens.chatgptPlanType,
    nestedTokens.chatgpt_plan_type,
    nestedTokens.plan_type,
    accountInfo.chatgptPlanType,
    source.account?.planType,
    accessInfo.chatgptPlanType
  );
  const sessionToken = pickString(
    input.sessionToken,
    input.session_token,
    source.sessionToken,
    source.session_token,
    nestedTokens.sessionToken,
    nestedTokens.session_token
  );
  const idTokenSynthetic = input.idTokenSynthetic ?? input.id_token_synthetic ?? source.idTokenSynthetic ?? source.id_token_synthetic;

  const connection = {
    provider: "codex",
    authType: "oauth",
    testStatus: "active",
  };

  if (accessToken) connection.accessToken = accessToken;
  if (refreshToken) connection.refreshToken = refreshToken;
  if (expiresIn) connection.expiresIn = expiresIn;
  if (explicitExpiresAt && !Number.isNaN(new Date(explicitExpiresAt).getTime())) {
    connection.expiresAt = new Date(explicitExpiresAt).toISOString();
  } else if (expiresIn) {
    connection.expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  } else if (accessInfo.expiresAt) {
    connection.expiresAt = accessInfo.expiresAt;
  }
  if (tokenType) connection.tokenType = tokenType;
  if (scope) connection.scope = scope;
  if (name) connection.name = name;
  if (email) connection.email = email;
  if (priority !== undefined) connection.priority = priority;
  if (isActive !== undefined) connection.isActive = isActive;

  const providerSpecificData = {};
  if (chatgptAccountId) providerSpecificData.chatgptAccountId = chatgptAccountId;
  if (chatgptPlanType) providerSpecificData.chatgptPlanType = chatgptPlanType;
  if (sessionToken) providerSpecificData.sessionToken = sessionToken;
  if (idTokenSynthetic !== undefined) providerSpecificData.idTokenSynthetic = !!idTokenSynthetic;
  if (!refreshToken && accessToken) providerSpecificData.importMode = "chatgpt_session_access_token";
  if (Object.keys(providerSpecificData).length) {
    connection.providerSpecificData = providerSpecificData;
  }

  return connection;
}
