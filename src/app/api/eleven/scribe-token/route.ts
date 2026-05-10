import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const baseUrl = process.env.ELEVENLABS_BASE_URL;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing ELEVENLABS_API_KEY. Add it to .env.local (local) or project env (Vercel), then restart the dev server.",
      },
      { status: 500 },
    );
  }

  const client = new ElevenLabsClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });

  try {
    const tokenResponse = await client.tokens.singleUse.create("realtime_scribe");
    const token = tokenResponse.token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "ElevenLabs returned an empty Scribe token." },
        { status: 502 },
      );
    }
    return NextResponse.json({ token });
  } catch (e: unknown) {
    console.error("[scribe-token]", e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "body" in e
          ? JSON.stringify((e as { body?: unknown }).body)
          : "Unknown ElevenLabs error";
    return NextResponse.json(
      {
        error: `Could not create Scribe token: ${msg}. Check that your API key is valid and has access to Speech-to-Text (Scribe).`,
      },
      { status: 502 },
    );
  }
}
