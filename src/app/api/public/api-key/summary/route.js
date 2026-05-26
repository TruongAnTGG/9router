import { NextResponse } from "next/server";
import { getApiKeyUsageSummaryByKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = body?.apiKey || body?.key || "";
    const summary = await getApiKeyUsageSummaryByKey(apiKey);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.log("Error inspecting API key:", error);
    return NextResponse.json({ error: "Failed to inspect API key" }, { status: 500 });
  }
}
