import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(1200),
  voiceId: z.string().min(1),
  modelId: z.enum(["eleven_flash_v2_5", "eleven_v3"]).default("eleven_flash_v2_5"),
  optimizeStreamingLatency: z.number().min(0).max(4).optional(),
});

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const baseUrl = process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY" },
      { status: 500 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { text, voiceId, modelId, optimizeStreamingLatency } = parsed.data;

  const url = new URL(`${baseUrl}/v1/text-to-speech/${voiceId}/stream`);
  url.searchParams.set("output_format", "mp3_44100_128");
  url.searchParams.set(
    "optimize_streaming_latency",
    String(optimizeStreamingLatency ?? 3),
  );

  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.85,
        style: 0.4,
        use_speaker_boost: true,
      },
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "TTS failed", status: upstream.status, details: err },
      { status: 500 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

