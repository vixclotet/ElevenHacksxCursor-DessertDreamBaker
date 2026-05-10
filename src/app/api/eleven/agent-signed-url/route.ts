import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const baseUrl = process.env.ELEVENLABS_BASE_URL;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY" },
      { status: 500 },
    );
  }
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_AGENT_ID" },
      { status: 500 },
    );
  }

  const client = new ElevenLabsClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });

  const res = await client.conversationalAi.conversations.getSignedUrl({
    agentId,
  });

  // SDK returns camelCase; API returns snake_case.
  const signedUrl = (res as unknown as { signedUrl?: string; signed_url?: string })
    .signedUrl ?? (res as unknown as { signed_url?: string }).signed_url;

  if (!signedUrl) {
    return NextResponse.json(
      { error: "Failed to fetch signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl });
}

