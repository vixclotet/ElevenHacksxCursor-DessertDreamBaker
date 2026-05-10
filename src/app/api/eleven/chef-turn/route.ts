import { NextResponse } from "next/server";
import { z } from "zod";

import { buildChefReply } from "@/lib/chefReply";
import { DESSERT_RECIPES } from "@/lib/recipes";

export const runtime = "nodejs";

const BodySchema = z.object({
  userLine: z.string().min(1).max(8000),
  activeRecipeId: z.string().nullable().optional(),
  stepIndex: z.number().int().min(0).optional(),
});

/**
 * Returns chef dialogue text only — no ElevenLabs ConvAI agent.
 * Speech pipeline: Scribe (STT) → this route → TTS on the client.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { userLine, activeRecipeId, stepIndex } = parsed.data;
  const activeRecipe =
    activeRecipeId != null
      ? (DESSERT_RECIPES.find((r) => r.id === activeRecipeId) ?? null)
      : null;

  const reply = buildChefReply(userLine, {
    activeRecipe,
    stepIndex: stepIndex ?? 0,
  });

  return NextResponse.json({ reply });
}
