import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { normalizeCodexImport } from "@/lib/oauth/codexImport";

function extractImportItems(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.sessions)) return body.sessions;
  if (Array.isArray(body?.accounts)) return body.accounts;
  if (Array.isArray(body?.connections)) return body.connections;
  if (Array.isArray(body?.items)) return body.items;
  return [body];
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
    importMode: connection.providerSpecificData?.importMode,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid or empty request body" }, { status: 400 });
    }

    const items = extractImportItems(body);
    if (!items.length) {
      return NextResponse.json({ error: "No Codex sessions found to import" }, { status: 400 });
    }

    const connections = [];
    for (const item of items) {
      const connectionData = normalizeCodexImport(item);
      connections.push(await createProviderConnection(connectionData));
    }

    return NextResponse.json({
      success: true,
      imported: connections.length,
      persistent: connections.some(connection => !!connection.refreshToken),
      connection: connections.length === 1 ? toSafeConnection(connections[0]) : undefined,
      connections: connections.map(toSafeConnection),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
