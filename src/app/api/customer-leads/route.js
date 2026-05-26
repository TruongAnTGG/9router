import { NextResponse } from "next/server";
import { getCustomerLeads } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leads = await getCustomerLeads({
      status: searchParams.get("status") || "",
      limit: searchParams.get("limit") || "200",
    });
    return NextResponse.json({ leads }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to load leads" }, { status: 500 });
  }
}

