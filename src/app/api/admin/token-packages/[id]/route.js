import { NextResponse } from "next/server";
import { getTokenPackageById, updateTokenPackage, deleteTokenPackage } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const tokenPackage = await getTokenPackageById(params.id);
    if (!tokenPackage) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ package: tokenPackage });
  } catch (error) {
    console.log("Error fetching token package:", error);
    return NextResponse.json({ error: "Failed to fetch token package" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const body = await request.json();
    const updated = await updateTokenPackage(params.id, body);
    return NextResponse.json({ package: updated });
  } catch (error) {
    if (error?.message === "Token package not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.log("Error updating token package:", error);
    return NextResponse.json({ error: "Failed to update token package" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const ok = await deleteTokenPackage(params.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting token package:", error);
    return NextResponse.json({ error: "Failed to delete token package" }, { status: 500 });
  }
}
