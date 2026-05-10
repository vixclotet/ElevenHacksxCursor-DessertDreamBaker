import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const baseUrl = process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY" },
      { status: 500 },
    );
  }

  const incoming = await req.formData().catch(() => null);
  if (!incoming) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const name = incoming.get("name");
  const file = incoming.get("file");
  const removeBg = incoming.get("remove_background_noise");

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const form = new FormData();
  form.set("name", name.trim());
  form.append("files", file, file.name || "voice.webm");
  if (removeBg === "true") form.set("remove_background_noise", "true");

  const upstream = await fetch(`${baseUrl}/v1/voices/add`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: form,
  });

  const json = await upstream.json().catch(() => null);
  if (!upstream.ok || !json) {
    return NextResponse.json(
      { error: "Voice clone failed", status: upstream.status, details: json },
      { status: 500 },
    );
  }

  // API response is snake_case
  const voiceId: string | undefined = json.voice_id;
  const requiresVerification: boolean | undefined = json.requires_verification;

  if (!voiceId) {
    return NextResponse.json(
      { error: "Voice clone returned no voice_id", details: json },
      { status: 500 },
    );
  }

  return NextResponse.json({ voiceId, requiresVerification: !!requiresVerification });
}

