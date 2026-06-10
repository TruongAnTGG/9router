import { NextResponse } from "next/server";
import { validateApiKeyDetailed, getTokenPackageById, createOrder, getSettings } from "@/lib/localDb";
import { buildPaymentInfo } from "@/lib/paymentQr";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKey, packageId } = body;

    if (!apiKey || !packageId) {
      return NextResponse.json({ error: "apiKey and packageId are required" }, { status: 400 });
    }

    const validation = await validateApiKeyDetailed(apiKey);
    if (!validation.valid && validation.reason !== "quota_exceeded") {
      return NextResponse.json({ error: validation.message || "Invalid API key" }, { status: 401 });
    }

    const keyId = validation.key?.id;
    if (!keyId) {
      return NextResponse.json({ error: "Could not resolve API key" }, { status: 401 });
    }

    const tokenPackage = await getTokenPackageById(packageId);
    if (!tokenPackage || !tokenPackage.isActive) {
      return NextResponse.json({ error: "Package not found or inactive" }, { status: 404 });
    }

    const order = await createOrder({
      apiKeyId: keyId,
      packageId: tokenPackage.id,
      packageName: tokenPackage.name,
      tokenAmount: tokenPackage.tokenAmount,
      price: tokenPackage.price,
      currency: tokenPackage.currency,
      status: "pending",
      paymentMethod: "sepay",
    });

    const settings = await getSettings();
    const payment = buildPaymentInfo(settings, order);

    return NextResponse.json({
      order,
      payment,
      message: "Đơn đã tạo. Token chỉ được cộng sau khi admin xác nhận đã nhận thanh toán.",
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating public token order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
