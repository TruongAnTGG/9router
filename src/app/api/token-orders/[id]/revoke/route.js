import { NextResponse } from "next/server";
import { revokeOrderPurchasedTokens } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const resolvedParams = await params;
    const result = await revokeOrderPurchasedTokens(resolvedParams.id, {
      reason: body.reason || "admin-revoke",
    });

    return NextResponse.json({
      order: result.order,
      apiKey: result.apiKey,
      revokedTokens: result.revokedTokens,
      alreadyRevoked: result.alreadyRevoked,
      message: result.alreadyRevoked
        ? "Order already revoked"
        : `Revoked ${result.revokedTokens.toLocaleString()} purchased tokens`,
    });
  } catch (error) {
    console.log("Error revoking order tokens:", error);
    const status = error.message === "Order not found" || error.message === "API key not found" ? 404 : 500;
    return NextResponse.json({ error: error.message || "Failed to revoke order tokens" }, { status });
  }
}
