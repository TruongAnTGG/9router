import { NextResponse } from "next/server";
import { getApiKeyUsageSummaryByKey, updateApiKeySelectedModelByKey } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = body?.apiKey || body?.key || "";
    const selectedModel = body?.selectedModel || body?.model || "";
    const result = await updateApiKeySelectedModelByKey(apiKey, selectedModel);

    if (!result?.ok) {
      return NextResponse.json({ error: result?.message || "Failed to update selected model" }, { status: 400 });
    }

    const summary = await getApiKeyUsageSummaryByKey(apiKey);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.log("Error updating API key selected model:", error);
    return NextResponse.json({ error: "Failed to update selected model" }, { status: 500 });
  }
}
