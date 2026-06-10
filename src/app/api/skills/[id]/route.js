import { NextResponse } from "next/server";
import { deleteSkill, getSkillById, updateSkill } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const skill = await getSkillById(id);
    if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    return NextResponse.json({ skill }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.log("Error fetching skill:", error);
    return NextResponse.json({ error: "Failed to fetch skill" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const skill = await updateSkill(id, body);
    if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    return NextResponse.json({ skill });
  } catch (error) {
    console.log("Error updating skill:", error);
    return NextResponse.json({ error: error.message || "Failed to update skill" }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteSkill(id);
    if (!deleted) return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    return NextResponse.json({ message: "Skill deleted successfully" });
  } catch (error) {
    console.log("Error deleting skill:", error);
    return NextResponse.json({ error: "Failed to delete skill" }, { status: 500 });
  }
}
