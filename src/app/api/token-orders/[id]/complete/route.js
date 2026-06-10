import { NextResponse } from "next/server";
import { completeOrderAndGrantTokens } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.paymentReceived !== true) {
      return NextResponse.json({ error: "Payment receipt confirmation is required" }, { status: 400 });
    }
    const resolvedParams = await params;
    const result = await completeOrderAndGrantTokens(resolvedParams.id, {
      paymentTransactionId: body.paymentTransactionId || null,
      paymentData: body.paymentData || null,
    });

    return NextResponse.json({
      order: result.order,
      grantedTokens: result.grantedTokens,
      apiKey: result.apiKey,
      alreadyCompleted: result.alreadyCompleted,
      message: result.alreadyCompleted ? "Order already completed" : `Granted ${result.grantedTokens} tokens`,
    });
  } catch (error) {
    console.log("Error completing order:", error);
    const status = error.message === "Order not found" || error.message === "API key not found" ? 404 : 500;
    return NextResponse.json({ error: error.message || "Failed to complete order" }, { status });
  }
}
