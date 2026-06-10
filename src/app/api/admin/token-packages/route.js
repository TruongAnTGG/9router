import { NextResponse } from "next/server";
import { getTokenPackages, createTokenPackage } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packages = await getTokenPackages({ activeOnly: false });
    return NextResponse.json({ packages });
  } catch (error) {
    console.log("Error fetching token packages:", error);
    return NextResponse.json({ error: "Failed to fetch token packages" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, tokenAmount, price, currency, isActive, displayOrder, features } = body;

    if (!name || !Number.isFinite(Number(tokenAmount)) || !Number.isFinite(Number(price))) {
      return NextResponse.json({ error: "name, tokenAmount, price are required" }, { status: 400 });
    }

    const tokenPackage = await createTokenPackage({
      name,
      description: description || null,
      tokenAmount: Number(tokenAmount),
      price: Number(price),
      currency: currency || "VND",
      isActive: isActive !== false,
      displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
      features: Array.isArray(features) ? features : null,
    });

    return NextResponse.json({ package: tokenPackage }, { status: 201 });
  } catch (error) {
    console.log("Error creating token package:", error);
    return NextResponse.json({ error: "Failed to create token package" }, { status: 500 });
  }
}
