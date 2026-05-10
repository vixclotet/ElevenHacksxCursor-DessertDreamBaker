"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CommitStrategy,
  Conversation,
  RealtimeEvents,
  Scribe,
} from "@elevenlabs/client";
import type { VoiceConversation } from "@elevenlabs/client";
import { Mic, MicOff, Sparkles, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { DESSERT_RECIPES, type Recipe } from "@/lib/recipes";
import { parseVoiceCommand } from "@/lib/voiceCommands";

type Timer = {
  id: string;
  label: string;
  endsAt: number;
  createdAt: number;
  lastAnnouncedSec: number | null;
};

type ChatLine = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
};

type Persona = {
  id: "grandma" | "mario" | "elegant";
  name: string;
  vibe: string;
  systemNudge: string;
  sfxStyle: string;
};

const PERSONAS: Persona[] = [
  {
    id: "grandma",
    name: "Grandma’s Kitchen",
    vibe: "cozy, warm, encouraging",
    systemNudge:
      "Speak like a warm grandma pastry chef. Be patient, reassuring, and very clear. Use gentle humor. Dessert-only.",
    sfxStyle:
      "soft kitchen foley: wooden spoon stir, gentle whisk, oven ding, happy sparkle",
  },
  {
    id: "mario",
    name: "Pastry Chef Mario",
    vibe: "playful, energetic, cheeky",
    systemNudge:
      "Speak like a playful cartoon Italian pastry chef. Keep it fun and fast. Dessert-only. Short punchy steps.",
    sfxStyle:
      "bouncy whooshes, mixer whirr, sparkly success chimes, comedic pop",
  },
  {
    id: "elegant",
    name: "Patisserie (Elegant)",
    vibe: "calm, refined, precise",
    systemNudge:
      "Speak like an elegant French pâtissier. Be precise with weights and timings. Dessert-only.",
    sfxStyle: "subtle foley, delicate bell dings, airy whooshes",
  },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function playAudioBlob(blob: Blob, volume = 1) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume));
  try {
    await audio.play();
  } finally {
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
  }
}

async function fetchAndPlayTts(opts: {
  text: string;
  voiceId: string;
  modelId: "eleven_flash_v2_5" | "eleven_v3";
  volume: number;
}) {
  const res = await fetch("/api/eleven/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: opts.text,
      voiceId: opts.voiceId,
      modelId: opts.modelId,
      optimizeStreamingLatency: opts.modelId === "eleven_flash_v2_5" ? 4 : 2,
    }),
  });
  if (!res.ok) return;
  const blob = await res.blob();
  await playAudioBlob(blob, opts.volume);
}

export default function DessertDreamBaker() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [mode, setMode] = useState<"listening" | "speaking" | "unknown">(
    "unknown",
  );
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [personaId, setPersonaId] = useState<Persona["id"]>(() => {
    if (typeof window === "undefined") return "grandma";
    const saved = window.localStorage.getItem("ddb.personaId");
    return (saved as Persona["id"]) || "grandma";
  });
  const [setupOpen, setSetupOpen] = useState(true);
  const [cloneName, setCloneName] = useState("My Kitchen Voice");
  const [cloneVoiceId, setCloneVoiceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("ddb.cloneVoiceId");
  });
  const [useMyVoiceForNarration, setUseMyVoiceForNarration] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("ddb.useMyVoiceForNarration");
    return saved ? saved === "true" : true;
  });
  const [cloneStatus, setCloneStatus] = useState<
    "idle" | "recording" | "uploading" | "ready" | "error"
  >("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [recordedChunkCount, setRecordedChunkCount] = useState(0);

  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const persona = useMemo(
    () => PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0],
    [personaId],
  );

  const activeRecipe: Recipe | null = useMemo(() => {
    if (!activeRecipeId) return null;
    return DESSERT_RECIPES.find((r) => r.id === activeRecipeId) ?? null;
  }, [activeRecipeId]);

  const [partial, setPartial] = useState("");
  const [lines, setLines] = useState<ChatLine[]>(() => [
    {
      id: uid(),
      role: "assistant",
      text: "Hi sweetheart. I’m Dessert Dream Baker—your hands-free AI sous-chef for desserts only. Tell me what you’re craving, or what you’ve got in your kitchen.",
      ts: Date.now(),
    },
  ]);

  const convoRef = useRef<VoiceConversation | null>(null);
  const scribeRef = useRef<ReturnType<typeof Scribe.connect> | null>(null);

  const addLine = useCallback((role: ChatLine["role"], text: string) => {
    setLines((prev) => [
      ...prev,
      { id: uid(), role, text: text.trim(), ts: Date.now() },
    ]);
  }, []);

  const playSfx = useCallback(
    async (text: string, durationSeconds?: number) => {
      try {
        const res = await fetch("/api/eleven/sound-effect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            durationSeconds,
            promptInfluence: 0.35,
          }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        await playAudioBlob(blob, Math.min(1, volume));
      } catch {
        // best-effort
      }
    },
    [volume],
  );

  const narrate = useCallback(
    async (text: string, kind: "fast" | "expressive" = "fast") => {
      if (!cloneVoiceId || !useMyVoiceForNarration) return;
      try {
        await fetchAndPlayTts({
          text,
          voiceId: cloneVoiceId,
          modelId: kind === "expressive" ? "eleven_v3" : "eleven_flash_v2_5",
          volume: Math.min(1, volume),
        });
      } catch {
        // best effort
      }
    },
    [cloneVoiceId, useMyVoiceForNarration, volume],
  );

  const announceCurrentStep = useCallback(async () => {
    if (!activeRecipe) return;
    const step = activeRecipe.steps[stepIndex];
    if (!step) return;

    // Keep the agent in sync, but use our own cloned narration when available.
    convoRef.current?.sendContextualUpdate(
      [
        `Active dessert recipe: ${activeRecipe.name}`,
        `Current step (${stepIndex + 1}/${activeRecipe.steps.length}): ${step}`,
        "If user says Next/Repeat/Substitute/Ingredients, respond with ONE concise step only.",
      ].join("\n"),
    );

    void playSfx("Soft whoosh page turn, gentle", 0.7);
    await narrate(`Step ${stepIndex + 1}. ${step}`, "expressive");
  }, [activeRecipe, narrate, playSfx, stepIndex]);

  const stopSession = useCallback(async () => {
    setStatus("idle");
    setMode("unknown");
    setPartial("");

    if (scribeRef.current) {
      try {
        scribeRef.current.close();
      } catch {
        // ignore
      }
      scribeRef.current = null;
    }

    if (convoRef.current) {
      try {
        await convoRef.current.endSession();
      } catch {
        // ignore
      }
      convoRef.current = null;
    }
  }, []);

  const startSession = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signedRes = await fetch("/api/eleven/agent-signed-url");
      if (!signedRes.ok) throw new Error("Failed to get agent signed URL");
      const { signedUrl } = (await signedRes.json()) as { signedUrl: string };

      const conversation = (await Conversation.startSession({
        signedUrl,
        onStatusChange: (payload) => {
          const s =
            typeof payload === "string"
              ? payload
              : (payload as { status?: string }).status;
          if (s === "connected") setStatus("connected");
          if (s === "connecting") setStatus("connecting");
          if (s === "disconnected") setStatus("idle");
        },
        onModeChange: (payload) => {
          const m =
            typeof payload === "string"
              ? payload
              : (payload as { mode?: string }).mode;
          if (m === "listening" || m === "speaking") setMode(m);
          else setMode("unknown");
        },
        onMessage: (message) => {
          const anyMsg = message as unknown as {
            source?: "user" | "agent";
            text?: string;
            message?: string;
            type?: string;
          };
          const text = anyMsg.text ?? anyMsg.message;
          if (!text) return;
          addLine(anyMsg.source === "user" ? "user" : "assistant", text);
        },
        onError: () => setStatus("error"),
      })) as VoiceConversation;

      convoRef.current = conversation;
      await conversation.setVolume({ volume });

      // We'll use Scribe v2 Realtime for STT and send text to the agent.
      // Mute the agent microphone so we don't double-capture audio.
      await conversation.setMicMuted(true);
      setIsMicMuted(true);

      conversation.sendContextualUpdate(
        [
          "You are Dessert Dream Baker, an AI sous-chef specialized exclusively in DESSERTS (cakes, cookies, pies, pastries, etc.).",
          "If the user asks for non-dessert food, politely refuse and steer back to desserts.",
          "Be step-by-step. Only give ONE step at a time and wait for: next, repeat, how much, substitute X, I'm done.",
          `Persona: ${persona.name} (${persona.vibe}).`,
          `Expressive tags allowed: [laughs], [excited], [whispers].`,
          cloneVoiceId
            ? "User has a cloned voice available for narration/timers (handled by the client). Keep your responses short and stepwise."
            : "No cloned voice available yet; keep responses short and stepwise.",
        ].join("\n"),
      );

      await playSfx(`Kitchen ambience, ${persona.sfxStyle}`, 1.2);

      const tokenRes = await fetch("/api/eleven/scribe-token");
      if (!tokenRes.ok) throw new Error("Failed to get Scribe token");
      const { token } = (await tokenRes.json()) as { token: string };

      const scribe = Scribe.connect({
        token,
        modelId: "scribe_v2_realtime",
        commitStrategy: CommitStrategy.VAD,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      scribe.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        setPartial(data.text ?? "");
      });

      scribe.on(RealtimeEvents.COMMITTED_TRANSCRIPT, async (data) => {
        const text = (data.text ?? "").trim();
        setPartial("");
        if (!text) return;

        addLine("user", text);

        const cmd = parseVoiceCommand(text, DESSERT_RECIPES);
        const lower = text.toLowerCase();

        // SFX keyed off common baking moments (plus timers).
        if (lower.includes("mix") || lower.includes("whisk")) {
          void playSfx("Mixing bowl whoosh and whisking, upbeat", 1.0);
        } else if (lower.includes("oven") || lower.includes("bake")) {
          void playSfx("Oven door open then gentle oven ding", 1.2);
        } else if (lower.includes("butter")) {
          void playSfx("Butter sizzling in a pan, cozy", 1.1);
        }

        if (cmd.type === "timer") {
          const id = uid();
          const label = cmd.label ?? "Timer";
          setTimers((prev) => [
            ...prev,
            {
              id,
              label,
              createdAt: Date.now(),
              endsAt: Date.now() + cmd.seconds * 1000,
              lastAnnouncedSec: null,
            },
          ]);
          void playSfx("Dramatic countdown sting then kitchen timer click", 1.2);
          void narrate(
            `[excited] Timer set for ${Math.round(cmd.seconds / 60)} minutes.`,
            "fast",
          );
          convoRef.current?.sendUserMessage(
            `User set a timer for ${cmd.seconds} seconds. Acknowledge briefly, then ask what dessert step is next.`,
          );
          return;
        }

        if (cmd.type === "start_recipe") {
          const target =
            cmd.recipeId ??
            (lower.includes("cookie") ? "ccc" : null) ??
            null;
          if (target) {
            setActiveRecipeId(target);
            setStepIndex(0);
            const recipe = DESSERT_RECIPES.find((r) => r.id === target)!;
            void playSfx("Happy sparkle chime, gentle", 0.9);
            void narrate(`[excited] Let’s make ${recipe.name}.`, "expressive");
            convoRef.current?.sendUserMessage(
              `We are starting ${recipe.name}. Give step 1 only, then wait for "next" or "repeat".`,
            );
            setTimeout(() => void announceCurrentStep(), 350);
            return;
          }
        }

        if (cmd.type === "ingredients" && activeRecipe) {
          void playSfx("Paper rustle, soft", 0.8);
          void narrate(
            `Ingredients for ${activeRecipe.name}. ${activeRecipe.ingredients
              .map((i) => i.item)
              .join(". ")}`,
            "fast",
          );
          convoRef.current?.sendUserMessage(
            `User asked for ingredients. List ingredients briefly for ${activeRecipe.name}, then ask if they want step ${stepIndex + 1}.`,
          );
          return;
        }

        if (cmd.type === "repeat" && activeRecipe) {
          void playSfx("Soft rewind whoosh", 0.7);
          void announceCurrentStep();
          convoRef.current?.sendUserMessage(
            `User said repeat. Repeat step ${stepIndex + 1} only.`,
          );
          return;
        }

        if (cmd.type === "next" && activeRecipe) {
          const nextIdx = Math.min(stepIndex + 1, activeRecipe.steps.length - 1);
          setStepIndex(nextIdx);
          setTimeout(() => void announceCurrentStep(), 250);
          convoRef.current?.sendUserMessage(
            `User said next. Provide step ${nextIdx + 1} only.`,
          );
          return;
        }

        if (cmd.type === "substitute" && activeRecipe) {
          const key = Object.keys(activeRecipe.substitutions).find((k) =>
            cmd.ingredient.toLowerCase().includes(k.replace("_", " ")),
          );
          const tips = key ? activeRecipe.substitutions[key] : null;
          if (tips?.length) {
            void playSfx("Helpful sparkle, soft", 0.7);
            void narrate(
              `Substitution for ${cmd.ingredient}. ${tips.join(" ")}`,
              "fast",
            );
            convoRef.current?.sendUserMessage(
              `User asked to substitute ${cmd.ingredient}. Suggest: ${tips.join(" ")} Then ask if they want to continue with step ${stepIndex + 1}.`,
            );
            return;
          }
        }

        // Otherwise, freeform goes to agent.
        convoRef.current?.sendUserMessage(text);
      });

      scribeRef.current = scribe;

      setStatus("connected");
    } catch (e) {
      console.error(e);
      setStatus("error");
      await stopSession();
    }
  }, [
    activeRecipe,
    addLine,
    announceCurrentStep,
    cloneVoiceId,
    narrate,
    persona,
    playSfx,
    status,
    stepIndex,
    stopSession,
    volume,
  ]);

  const toggleMute = useCallback(async () => {
    const convo = convoRef.current;
    if (!convo) return;
    const next = !isMicMuted;
    setIsMicMuted(next);
    await convo.setMicMuted(next);
  }, [isMicMuted]);

  useEffect(() => {
    const convo = convoRef.current;
    if (!convo) return;
    void convo.setVolume({ volume });
  }, [volume]);

  // Load is handled in useState initializers (avoids setState-in-effect lint).

  useEffect(() => {
    try {
      if (cloneVoiceId) localStorage.setItem("ddb.cloneVoiceId", cloneVoiceId);
      localStorage.setItem(
        "ddb.useMyVoiceForNarration",
        String(useMyVoiceForNarration),
      );
      localStorage.setItem("ddb.personaId", personaId);
    } catch {
      // ignore
    }
  }, [cloneVoiceId, personaId, useMyVoiceForNarration]);

  // Timer ticking + announcements
  useEffect(() => {
    if (!timers.length) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setTimers((prev) => {
        return prev
          .map((t) => {
            const remainingSec = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
            const announceAt = [600, 300, 60, 10, 0]; // 10m, 5m, 1m, 10s, done
            if (
              announceAt.includes(remainingSec) &&
              t.lastAnnouncedSec !== remainingSec
            ) {
              if (remainingSec === 0) {
                void playSfx("Oven ding, joyful sparkle celebration", 1.4);
                void narrate(`[excited] Timer done! Time to check your dessert.`, "expressive");
              } else if (remainingSec <= 10) {
                void playSfx("Dramatic countdown tick", 1.0);
                void narrate(`[whispers] ${remainingSec}…`, "fast");
              } else {
                const mins = Math.round(remainingSec / 60);
                void playSfx("Kitchen timer ding, soft", 1.0);
                void narrate(`${mins} minutes left.`, "fast");
              }
            }
            return {
              ...t,
              lastAnnouncedSec:
                announceAt.includes(remainingSec) ? remainingSec : t.lastAnnouncedSec,
            };
          })
          .filter((t) => t.endsAt > now - 10_000); // keep for 10s after done
      });
    }, 500);
    return () => window.clearInterval(interval);
  }, [narrate, playSfx, timers.length]);

  const startRecording = useCallback(async () => {
    setCloneStatus("recording");
    recordedChunksRef.current = [];
    setRecordedChunkCount(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(250);
      const tick = window.setInterval(() => {
        setRecordedChunkCount(recordedChunksRef.current.length);
      }, 250);
      // auto-stop after 15s
      window.setTimeout(() => {
        if (mr.state === "recording") mr.stop();
        window.clearInterval(tick);
      }, 15_000);
    } catch {
      setCloneStatus("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") mr.stop();
    setCloneStatus("uploading");
  }, []);

  const createClone = useCallback(async () => {
    try {
      setCloneStatus("uploading");
      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.set("name", cloneName);
      form.set("remove_background_noise", "false");
      form.append("file", blob, "voice.webm");

      const res = await fetch("/api/eleven/voice-clone", { method: "POST", body: form });
      if (!res.ok) throw new Error("clone failed");
      const data = (await res.json()) as { voiceId: string };
      setCloneVoiceId(data.voiceId);
      setCloneStatus("ready");
      void playSfx("Happy sparkle chime, success", 1.0);
      void narrate("[excited] Voice clone ready!", "expressive");
    } catch {
      setCloneStatus("error");
    }
  }, [cloneName, narrate, playSfx]);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(60%_40%_at_20%_10%,#fde68a33,transparent_70%),radial-gradient(50%_35%_at_80%_0%,#fbcfe833,transparent_60%),radial-gradient(45%_40%_at_50%_100%,#a7f3d033,transparent_60%),linear-gradient(#fff,#fff)]">
      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-zinc-900">
                  Welcome to Dessert Dream Baker
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Choose a vibe, then optionally clone your voice for dramatic
                  timers and step narration.
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => setSetupOpen(false)}
              >
                Done
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Dessert mood
                </div>
                <div className="mt-2 space-y-2">
                  {PERSONAS.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2",
                        personaId === p.id
                          ? "border-pink-200 bg-pink-50"
                          : "border-black/10 bg-white hover:bg-zinc-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="persona"
                        value={p.id}
                        checked={personaId === p.id}
                        onChange={() => setPersonaId(p.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium text-zinc-900">
                          {p.name}
                        </div>
                        <div className="text-xs text-zinc-600">{p.vibe}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-sm font-semibold text-zinc-900">
                  Clone your voice (optional)
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Record ~15 seconds in a quiet room. We’ll use it for timers
                  and narration.
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="Voice name"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void (cloneStatus === "recording"
                          ? stopRecording()
                          : startRecording())
                      }
                      className={cn(
                        "h-10 rounded-xl px-4 text-sm font-medium shadow-sm transition",
                        cloneStatus === "recording"
                          ? "bg-zinc-900 text-white hover:bg-zinc-800"
                          : "bg-emerald-600 text-white hover:bg-emerald-500",
                      )}
                      disabled={
                        cloneStatus === "uploading" || cloneStatus === "ready"
                      }
                    >
                      {cloneStatus === "recording"
                        ? "Stop recording"
                        : "Record 15s"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void createClone()}
                      className={cn(
                        "h-10 rounded-xl px-4 text-sm font-medium shadow-sm transition",
                        "bg-pink-600 text-white hover:bg-pink-500",
                        (cloneStatus !== "uploading" &&
                          recordedChunkCount === 0) &&
                          "opacity-50 pointer-events-none",
                      )}
                      disabled={cloneStatus === "recording"}
                      title={
                        recordedChunkCount === 0
                          ? "Record first"
                          : "Create voice clone"
                      }
                    >
                      {cloneStatus === "uploading"
                        ? "Cloning…"
                        : cloneStatus === "ready"
                          ? "Cloned"
                          : "Create clone"}
                    </button>
                  </div>

                  <label className="mt-1 flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={useMyVoiceForNarration}
                      onChange={(e) =>
                        setUseMyVoiceForNarration(e.target.checked)
                      }
                      disabled={!cloneVoiceId}
                    />
                    Use my voice for narration & timers
                  </label>

                  <div className="text-xs text-zinc-600">
                    Status:{" "}
                    <span className="font-medium text-zinc-900">
                      {cloneVoiceId
                        ? "Ready"
                        : cloneStatus === "recording"
                          ? "Recording"
                          : cloneStatus === "uploading"
                            ? "Uploading"
                            : cloneStatus === "error"
                              ? "Error"
                              : "Not set"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-700">
                Tip: say “start chocolate chip cookies”, then “next”, “repeat”,
                “ingredients”, or “set a timer for 10 minutes”.
              </div>
              <button
                type="button"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                onClick={() => setSetupOpen(false)}
              >
                Start baking
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-black/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Fully voice-first • desserts only
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
              Dessert Dream Baker
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Hands-free AI sous-chef powered by ElevenLabs Agents + Scribe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border border-black/10 bg-white/70 px-3 text-sm text-zinc-900 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-pink-300"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value as Persona["id"])}
              aria-label="Voice persona"
              disabled={status === "connecting"}
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void (status === "connected" ? stopSession() : startSession())}
              className={cn(
                "h-10 rounded-xl px-4 text-sm font-medium shadow-sm transition active:scale-[0.99]",
                status === "connected"
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "bg-pink-600 text-white hover:bg-pink-500",
                status === "connecting" && "opacity-60 pointer-events-none",
              )}
            >
              {status === "connected"
                ? "Stop"
                : status === "connecting"
                  ? "Connecting…"
                  : "Start (Hands-free)"}
            </button>
          </div>
        </header>

        <main className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    status === "connected"
                      ? "bg-emerald-500"
                      : status === "connecting"
                        ? "bg-amber-500"
                        : status === "error"
                          ? "bg-red-500"
                          : "bg-zinc-300",
                  )}
                />
                <span className="text-zinc-700">
                  {status === "connected"
                    ? `Connected • ${mode}`
                    : status === "connecting"
                      ? "Connecting"
                      : status === "error"
                        ? "Error"
                        : "Idle"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleMute()}
                  disabled={status !== "connected"}
                  className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/70 shadow-sm backdrop-blur transition disabled:opacity-50",
                    isMicMuted ? "text-zinc-500" : "text-zinc-900",
                  )}
                  aria-label={isMicMuted ? "Unmute mic" : "Mute mic"}
                  title={
                    isMicMuted
                      ? "Mic muted (agent uses Scribe STT)"
                      : "Mic live"
                  }
                >
                  {isMicMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>

                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                  <Volume2 className="h-4 w-4 text-zinc-700" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-28"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-black/5 bg-white/80 p-3">
              <div className="text-xs font-medium text-zinc-600">
                Live transcription
              </div>
              <div className="mt-1 min-h-6 text-sm text-zinc-900">
                {partial ? (
                  <span className="text-zinc-900">{partial}</span>
                ) : (
                  <span className="text-zinc-400">
                    {status === "connected"
                      ? "Speak naturally…"
                      : "Press Start, then speak."}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 max-h-[54vh] overflow-auto pr-1">
              <div className="space-y-3">
                {lines.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-6",
                      l.role === "assistant"
                        ? "bg-emerald-50 text-emerald-950 border border-emerald-100"
                        : l.role === "user"
                          ? "bg-pink-50 text-pink-950 border border-pink-100 ml-8"
                          : "bg-zinc-50 text-zinc-800 border border-zinc-100",
                    )}
                  >
                    <div className="mb-1 text-[11px] font-medium opacity-70">
                      {l.role === "assistant"
                        ? persona.name
                        : l.role === "user"
                          ? "You"
                          : "System"}
                    </div>
                    <div className="whitespace-pre-wrap">{l.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="text-sm font-semibold text-zinc-900">
              Voice commands
            </div>
            <ul className="mt-2 space-y-2 text-sm text-zinc-700">
              <li>
                <span className="font-medium text-zinc-900">“Walk me through…”</span>{" "}
                with what you have.
              </li>
              <li>
                <span className="font-medium text-zinc-900">“Next”</span>,{" "}
                <span className="font-medium text-zinc-900">“Repeat”</span>,{" "}
                <span className="font-medium text-zinc-900">“How much?”</span>
              </li>
              <li>
                <span className="font-medium text-zinc-900">“Substitute X”</span>{" "}
                (allergies/diet swaps).
              </li>
              <li>
                <span className="font-medium text-zinc-900">“Set a timer…”</span>{" "}
                (dramatic).
              </li>
            </ul>

            <div className="mt-5 rounded-xl border border-black/5 bg-white/80 p-3">
              <div className="text-xs font-medium text-zinc-600">
                Persona vibe
              </div>
              <div className="mt-1 text-sm text-zinc-900">
                <span className="font-medium">{persona.name}</span>{" "}
                <span className="text-zinc-600">— {persona.vibe}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-black/5 bg-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-zinc-600">
                  Dessert recipe
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-pink-700 hover:text-pink-800"
                  onClick={() => setSetupOpen(true)}
                >
                  Setup
                </button>
              </div>

              {activeRecipe ? (
                <div className="mt-2">
                  <div className="text-sm font-semibold text-zinc-900">
                    {activeRecipe.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Step {stepIndex + 1} of {activeRecipe.steps.length} •{" "}
                    {activeRecipe.time}
                  </div>
                  <div className="mt-2 text-sm text-zinc-800">
                    {activeRecipe.steps[stepIndex]}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-xl border border-black/10 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                      onClick={() => {
                        void announceCurrentStep();
                      }}
                    >
                      Repeat step
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-xl bg-pink-600 text-sm font-medium text-white hover:bg-pink-500"
                      onClick={() => {
                        const nextIdx = Math.min(
                          stepIndex + 1,
                          activeRecipe.steps.length - 1,
                        );
                        setStepIndex(nextIdx);
                        setTimeout(() => void announceCurrentStep(), 150);
                      }}
                    >
                      Next step
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-700">
                  Say “start chocolate chip cookies” (or brownies / cheesecake).
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-black/5 bg-white/80 p-3">
              <div className="text-xs font-medium text-zinc-600">Timers</div>
              {timers.length ? (
                <div className="mt-2 space-y-2">
                  {timers.slice(0, 3).map((t) => {
                    const remaining = Math.max(
                      0,
                      Math.ceil((t.endsAt - nowMs) / 1000),
                    );
                    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
                    const ss = String(remaining % 60).padStart(2, "0");
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                      >
                        <span className="text-zinc-800">{t.label}</span>
                        <span className="font-medium text-zinc-900">
                          {mm}:{ss}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-700">
                  Say “set a timer for 10 minutes”.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-black/5 bg-white/80 p-3">
              <div className="text-xs font-medium text-zinc-600">Tip</div>
              <div className="mt-1 text-sm text-zinc-800">
                If you want the agent to “feel” like the persona, say:{" "}
                <span className="font-medium">
                  “Stay in character as {persona.name}.”
                </span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

