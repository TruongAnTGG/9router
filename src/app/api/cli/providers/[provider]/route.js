import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { normalizeCodexImport } from "@/lib/oauth/codexImport";

export const dynamic = "force-dynamic";

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

function normalizeCliOAuthConnection(provider, body = {}) {
  if (provider === "codex") {
    return normalizeCodexImport(body);
  }

  const accessToken = pickString(body.accessToken, body.access_token, body.copilotToken);
  const refreshToken = pickString(body.refreshToken, body.refresh_token);
  if (!accessToken && !refreshToken) {
    throw new Error("Missing accessToken or refreshToken");
  }

  const expiresIn = pickNumber(body.expiresIn, body.expires_in);
  const expiresAt = pickString(body.expiresAt, body.expires_at);
  const email = pickString(body.email, body.userInfo?.email, body.userInfo?.login);
  const name = pickString(body.name, body.displayName, email, body.userInfo?.name, body.userInfo?.login);

  const providerSpecificData = {
    ...(body.providerSpecificData || {}),
  };
  if (body.resourceUrl) providerSpecificData.resourceUrl = body.resourceUrl;
  if (body.projectId) providerSpecificData.projectId = body.projectId;
  if (body.userInfo) providerSpecificData.userInfo = body.userInfo;
  if (body.copilotTokenInfo) providerSpecificData.copilotTokenInfo = body.copilotTokenInfo;

  const connection = {
    provider,
    authType: "oauth",
    testStatus: "active",
  };
  if (accessToken) connection.accessToken = accessToken;
  if (refreshToken) connection.refreshToken = refreshToken;
  if (expiresIn) {
    connection.expiresIn = expiresIn;
    connection.expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  } else if (expiresAt && !Number.isNaN(new Date(expiresAt).getTime())) {
    connection.expiresAt = new Date(expiresAt).toISOString();
  }
  if (email) connection.email = email;
  if (name) connection.name = name;
  if (body.scope) connection.scope = body.scope;
  if (body.idToken) connection.idToken = body.idToken;
  if (body.projectId) connection.projectId = body.projectId;
  if (Object.keys(providerSpecificData).length) {
    connection.providerSpecificData = providerSpecificData;
  }

  return connection;
}

function toSafeConnection(connection) {
  return {
    id: connection.id,
    provider: connection.provider,
    authType: connection.authType,
    name: connection.name,
    email: connection.email,
    priority: connection.priority,
    isActive: connection.isActive,
    expiresAt: connection.expiresAt,
    testStatus: connection.testStatus,
    providerSpecificData: connection.providerSpecificData,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export async function POST(request, { params }) {
  try {
    const { provider } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid or empty request body" }, { status: 400 });
    }

    const connectionData = normalizeCliOAuthConnection(provider, body);
    const connection = await createProviderConnection(connectionData);

    return NextResponse.json({
      success: true,
      connection: toSafeConnection(connection),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
