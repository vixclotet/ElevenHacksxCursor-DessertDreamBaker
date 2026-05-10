import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const baseUrl = process.env.ELEVENLABS_BASE_URL;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY" },
      { status: 500 },
    );
  }

  const client = new ElevenLabsClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });

  const token = await client.tokens.singleUse.create("realtime_scribe");

  return NextResponse.json(token);
}

