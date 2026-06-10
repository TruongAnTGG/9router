import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAYMENT_KEYS = [
  "paymentBankEnabled",
  "paymentBankCode",
  "paymentBankAccountNumber",
  "paymentBankAccountName",
  "paymentBankNotePrefix",
];

function pickPaymentSettings(settings) {
  return Object.fromEntries(PAYMENT_KEYS.map((key) => [key, settings[key] ?? ""]));
}

function normalizePaymentSettings(body) {
  const updates = {};
  for (const key of PAYMENT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    updates[key] = key === "paymentBankEnabled" ? body[key] === true : String(body[key] || "").trim();
  }
  return updates;
}

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(pickPaymentSettings(settings), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.log("Error getting payment settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const settings = await updateSettings(normalizePaymentSettings(body));
    return NextResponse.json(pickPaymentSettings(settings), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.log("Error updating payment settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
