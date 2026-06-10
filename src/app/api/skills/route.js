import { NextResponse } from "next/server";
import { createSkill, getSkills } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const skills = await getSkills();
    return NextResponse.json({ skills }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.log("Error fetching skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const skill = await createSkill(body);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    console.log("Error creating skill:", error);
    return NextResponse.json({ error: error.message || "Failed to create skill" }, { status: 400 });
  }
}
