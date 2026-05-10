import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(400),
  durationSeconds: z.number().min(0.5).max(30).optional(),
  promptInfluence: z.number().min(0).max(1).optional(),
  loop: z.boolean().optional(),
});

function isReadableStream(v: unknown): v is ReadableStream {
  return (
    typeof v === "object" &&
    v !== null &&
    "getReader" in (v as Record<string, unknown>)
  );
}

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const baseUrl = process.env.ELEVENLABS_BASE_URL;

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

  const client = new ElevenLabsClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });

  const audio = await client.textToSoundEffects.convert({
    text: parsed.data.text,
    durationSeconds: parsed.data.durationSeconds,
    promptInfluence: parsed.data.promptInfluence,
    loop: parsed.data.loop,
  });

  if (isReadableStream(audio)) {
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  }

  // The SDK may return a Uint8Array/Buffer-like object.
  const a: unknown = audio;
  const bytes =
    a instanceof ArrayBuffer
      ? new Uint8Array(a)
      : a instanceof Uint8Array
        ? a
        : new Uint8Array(a as ArrayBuffer);

  const arrayBuffer: ArrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

