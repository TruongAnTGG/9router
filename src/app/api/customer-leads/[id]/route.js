import { NextResponse } from "next/server";
import { updateCustomerLeadStatus } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const lead = await updateCustomerLeadStatus(id, body?.status);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ lead }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to update lead" }, { status: 400 });
  }
}
