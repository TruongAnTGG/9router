import { NextResponse } from "next/server";
import { createCustomerLead } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const lead = await createCustomerLead({
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
      company: body?.company,
      packageName: body?.packageName,
      tokenVolume: body?.tokenVolume,
      budget: body?.budget,
      message: body?.message,
      source: "landing",
    });

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (error) {
    const message = error?.message || "Failed to submit request";
    const status = /required/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

