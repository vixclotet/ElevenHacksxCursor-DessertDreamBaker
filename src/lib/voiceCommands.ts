import type { Recipe } from "@/lib/recipes";

export type ParsedCommand =
  | { type: "next" }
  | { type: "repeat" }
  | { type: "ingredients" }
  | { type: "start_recipe"; recipeId?: string; query?: string }
  | { type: "substitute"; ingredient: string }
  | { type: "timer"; seconds: number; label?: string }
  | { type: "freeform"; text: string };

const WORD_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
};

function parseNumber(s: string): number | null {
  const m = s.match(/(\d+(\.\d+)?)/);
  if (m) return Number(m[1]);
  const words = s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    if (w in WORD_NUM) return WORD_NUM[w]!;
  }
  return null;
}

export function parseVoiceCommand(textRaw: string, recipes: Recipe[]): ParsedCommand {
  const text = textRaw.trim();
  const lower = text.toLowerCase();

  if (/^(next|go on|continue|okay next)\b/.test(lower)) return { type: "next" };
  if (/^(repeat|say that again|again)\b/.test(lower)) return { type: "repeat" };
  if (/\bingredients\b/.test(lower)) return { type: "ingredients" };

  if (/\bsubstitute\b/.test(lower) || /\bswap\b/.test(lower)) {
    const m = lower.match(/\b(substitute|swap)\b\s+(.+)$/);
    const ing = m?.[2]?.trim();
    if (ing) return { type: "substitute", ingredient: ing };
  }

  if (/\b(timer|set a timer|set timer)\b/.test(lower)) {
    const minutes = /\b(min|mins|minute|minutes)\b/.test(lower);
    const hours = /\b(hr|hrs|hour|hours)\b/.test(lower);
    const n = parseNumber(lower);
    if (n !== null) {
      const seconds = hours ? Math.round(n * 3600) : minutes ? Math.round(n * 60) : Math.round(n);
      if (seconds > 0) {
        return { type: "timer", seconds, label: "Timer" };
      }
    }
  }

  if (/\b(start|begin|let's make|make)\b/.test(lower)) {
    const hit =
      recipes.find((r) => lower.includes(r.name.toLowerCase().split("(")[0]!.trim())) ??
      recipes.find((r) => lower.includes(r.id));

    return {
      type: "start_recipe",
      recipeId: hit?.id,
      query: hit ? undefined : text,
    };
  }

  return { type: "freeform", text };
}

