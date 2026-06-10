import { NextResponse } from "next/server";
import { getOrders, createOrder, getTokenPackageById, getApiKeyById, getSettings } from "@/lib/localDb";
import { buildPaymentInfo } from "@/lib/paymentQr";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get("apiKeyId") || null;
    const status = searchParams.get("status") || null;
    const orders = await getOrders({ apiKeyId, status, limit: 100, offset: 0 });
    return NextResponse.json({ orders });
  } catch (error) {
    console.log("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKeyId, packageId, paymentMethod } = body;

    if (!apiKeyId || !packageId) {
      return NextResponse.json({ error: "apiKeyId and packageId are required" }, { status: 400 });
    }

    const apiKey = await getApiKeyById(apiKeyId);
    if (!apiKey) return NextResponse.json({ error: "API key not found" }, { status: 404 });

    const tokenPackage = await getTokenPackageById(packageId);
    if (!tokenPackage || !tokenPackage.isActive) {
      return NextResponse.json({ error: "Package not found or inactive" }, { status: 404 });
    }

    const order = await createOrder({
      apiKeyId,
      packageId: tokenPackage.id,
      packageName: tokenPackage.name,
      tokenAmount: tokenPackage.tokenAmount,
      price: tokenPackage.price,
      currency: tokenPackage.currency,
      status: "pending",
      paymentMethod: paymentMethod || "sepay",
    });
    const settings = await getSettings();
    const payment = buildPaymentInfo(settings, order);

    return NextResponse.json({ order, payment }, { status: 201 });
  } catch (error) {
    console.log("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
