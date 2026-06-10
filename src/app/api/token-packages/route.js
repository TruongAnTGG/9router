import { NextResponse } from "next/server";
import { getTokenPackages } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packages = await getTokenPackages({ activeOnly: true });
    return NextResponse.json({ packages });
  } catch (error) {
    console.log("Error fetching active token packages:", error);
    return NextResponse.json({ error: "Failed to fetch token packages" }, { status: 500 });
  }
}
