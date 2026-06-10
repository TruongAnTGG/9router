import { NextResponse } from "next/server";
import { handleChat } from "@/sse/handlers/chat.js";

export const dynamic = "force-dynamic";

function extractJson(text) {
  const raw = String(text || "").trim();
  try { return JSON.parse(raw); } catch { }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    try { return JSON.parse(fenced); } catch { }
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("LLM did not return valid JSON");
}

export async function POST(request) {
  try {
    const { model, brief, language = "vi", apiKey } = await request.json();
    if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });
    if (!brief) return NextResponse.json({ error: "brief is required" }, { status: 400 });

    const prompt = `Create one reusable 9router skill from this admin brief. Return JSON only with keys: name, slug, description, instructions, tags. Language: ${language}. Brief: ${brief}`;
    const chatRequest = new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You create safe, concise API skills. Output JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    const response = await handleChat(chatRequest);
    const payload = await response.json();
    if (!response.ok) return NextResponse.json(payload, { status: response.status });
    const content = payload?.choices?.[0]?.message?.content || payload?.content?.[0]?.text || "";
    const skill = extractJson(content);
    return NextResponse.json({ skill });
  } catch (error) {
    console.log("Error generating skill:", error);
    return NextResponse.json({ error: error.message || "Failed to generate skill" }, { status: 500 });
  }
}
