import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { normalizeCodexImport } from "@/lib/oauth/codexImport";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid or empty request body" }, { status: 400 });
    }

    const connectionData = normalizeCodexImport(body);
    const connection = await createProviderConnection(connectionData);

    return NextResponse.json({
      success: true,
      persistent: !!connection.refreshToken,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
        displayName: connection.displayName,
        expiresAt: connection.expiresAt,
        importMode: connection.providerSpecificData?.importMode,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
