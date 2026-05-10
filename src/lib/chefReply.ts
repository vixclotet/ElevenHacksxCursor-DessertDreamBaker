import { DESSERT_RECIPES, type Recipe } from "@/lib/recipes";

export type ChefContext = {
  activeRecipe: Recipe | null;
  stepIndex: number;
};

/**
 * Local “chef” copy — no ConvAI agent. ElevenLabs is used only for STT/TTS/SFX/voices elsewhere.
 */
export function buildChefReply(userLine: string, ctx: ChefContext): string {
  const line = userLine.trim();
  const lower = line.toLowerCase();

  // Timer (from app prompt)
  const timerM = line.match(/user set a timer for (\d+) seconds/i);
  if (timerM) {
    const sec = Number(timerM[1]);
    const mins = Math.max(1, Math.round(sec / 60));
    return `Timer’s on—about ${mins} minute${mins === 1 ? "" : "s"}. When you’re ready, say next or tell me what you’re working on.`;
  }

  // Recipe start (from app prompt)
  const startM = line.match(/we are starting (.+?)\.\s*give step 1/i);
  if (startM) {
    const hint = startM[1]!.trim();
    const recipe =
      DESSERT_RECIPES.find((r) => r.name.toLowerCase().includes(hint.toLowerCase())) ??
      DESSERT_RECIPES.find((r) => hint.toLowerCase().includes(r.id)) ??
      ctx.activeRecipe;
    const first = recipe?.steps[0];
    if (recipe && first) {
      return `Perfect—we’re making ${recipe.name}. Step 1: ${first}`;
    }
    return "Say start cookies, start brownies, or ask for cheesecake cups—I’ll walk you through one step at a time.";
  }

  // Ingredients (from app prompt)
  if (line.includes("User asked for ingredients") && ctx.activeRecipe) {
    const items = ctx.activeRecipe.ingredients.map((i) => i.item).join("; ");
    return `Ingredients for ${ctx.activeRecipe.name}: ${items}. Say repeat for the current step or next when you’re ready.`;
  }

  // Repeat step (explicit step number in prompt)
  const repeatM = line.match(/user said repeat\. repeat step (\d+)/i);
  if (repeatM && ctx.activeRecipe) {
    const n = Number(repeatM[1]);
    const step = ctx.activeRecipe.steps[n - 1];
    if (step) {
      return `Step ${n}: ${step}`;
    }
  }

  // Next step (explicit step number in prompt)
  const nextM = line.match(/user said next\. provide step (\d+)/i);
  if (nextM && ctx.activeRecipe) {
    const n = Number(nextM[1]);
    const step = ctx.activeRecipe.steps[n - 1];
    if (step) {
      return `Step ${n}: ${step}`;
    }
  }

  // Substitution (prompt includes tips from our recipe DB)
  if (line.includes("User asked to substitute") && ctx.activeRecipe) {
    const ingMatch = line.match(/substitute\s+([^.]+)\./i);
    const ingredient = ingMatch?.[1]?.trim() ?? "that ingredient";
    const suggestIdx = line.indexOf("Suggest:");
    if (suggestIdx >= 0) {
      const afterSuggest = line.slice(suggestIdx + "Suggest:".length).trim();
      const tips = afterSuggest.split(/\s+Then ask\b/i)[0]?.trim() ?? afterSuggest;
      if (tips) {
        return `For ${ingredient}, try: ${tips} Say next when you’re ready to continue.`;
      }
    }
  }

  // Help (from speakHelp)
  if (/\buser asked for help\b/i.test(line)) {
    return "Here’s the short version: say start cookies or start brownies, then next and repeat for steps. Say ingredients, set a timer for ten minutes, open settings, or start demo. I only do desserts—keep it sweet.";
  }

  // Butter substitute demo line
  if (
    line.includes("butter substitute") ||
    (line.includes("substitute") && line.includes("butter"))
  ) {
    return "No butter? Use vegan butter sticks, or salted butter and cut the added salt a bit. Say next when you’re ready.";
  }

  // Freeform with active recipe — stay on-rails
  if (ctx.activeRecipe) {
    const step = ctx.activeRecipe.steps[ctx.stepIndex];
    const total = ctx.activeRecipe.steps.length;
    if (step) {
      return `Still on ${ctx.activeRecipe.name}, step ${ctx.stepIndex + 1} of ${total}. Current step: ${step} Say next, repeat, or ask for a substitute.`;
    }
  }

  // Freeform — steer to desserts + recipes
  if (/\b(cookie|chocolate chip|ccc)\b/.test(lower)) {
    return "Chocolate chip cookies are a great choice—say start cookies and I’ll guide you step by step.";
  }
  if (/\b(brownie|brownies)\b/.test(lower)) {
    return "Brownies it is—say start brownies when you’re ready for step one.";
  }
  if (/\b(cheesecake|no-?bake)\b/.test(lower)) {
    return "Love a no-bake moment—say start cheesecake if your phrase matches, or say start no bake cheesecake cups from the menu.";
  }

  if (/\b(hello|hi|hey)\b/.test(lower)) {
    return "Hey—welcome to Dessert Dream Baker. Say start cookies, start brownies, or tell me what dessert you’re craving.";
  }

  return "I’m dessert-only and hands-free friendly. Try start cookies, next, repeat, ingredients, or set a timer for five minutes. What dessert are we making?";
}
