"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CommitStrategy, Conversation, RealtimeEvents, Scribe } from "@elevenlabs/client";
import type { VoiceConversation } from "@elevenlabs/client";
import {
  Command,
  Mic,
  Moon,
  Sparkles,
  Sun,
  Wand2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/cn";
import { DESSERT_RECIPES, type Recipe } from "@/lib/recipes";
import { parseVoiceCommand } from "@/lib/voiceCommands";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ChefMascotMark } from "@/components/ChefMascotMark";

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

const STUDIO_VIBE =
  "Modern luxury baking studio — calm, empowering, step-by-step guidance.";
const STUDIO_SFX_STYLE =
  "soft studio foley: gentle whisk, airy whoosh, warm oven ding, subtle sparkle";

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
  const { theme, setTheme } = useTheme();

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [mode, setMode] = useState<"listening" | "speaking" | "unknown">("unknown");
  const [volume, setVolume] = useState(0.92);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cloneName, setCloneName] = useState("My Voice");
  const [cloneVoiceId, setCloneVoiceId] = useState<string | null>(null);
  const [useMyVoiceForNarration, setUseMyVoiceForNarration] = useState(true);
  const [cloneStatus, setCloneStatus] = useState<
    "idle" | "recording" | "uploading" | "ready" | "error"
  >("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [recordedChunkCount, setRecordedChunkCount] = useState(0);

  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [, setNowMs] = useState(() => Date.now());

  const activeRecipe: Recipe | null = useMemo(() => {
    if (!activeRecipeId) return null;
    return DESSERT_RECIPES.find((r) => r.id === activeRecipeId) ?? null;
  }, [activeRecipeId]);

  const [partial, setPartial] = useState("");
  const [, setLines] = useState<ChatLine[]>(() => []);

  const convoRef = useRef<VoiceConversation | null>(null);
  const scribeRef = useRef<ReturnType<typeof Scribe.connect> | null>(null);

  const addLine = useCallback((role: ChatLine["role"], text: string) => {
    setLines((prev) => [
      ...prev,
      { id: uid(), role, text: text.trim(), ts: Date.now() },
    ]);
  }, []);

  // ingredient UI removed; keep voice-only
  // ingredients are guided by voice; no checklist UI

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

      conversation.sendContextualUpdate(
        [
          "You are Dessert Dream Baker, an AI sous-chef specialized exclusively in DESSERTS (cakes, cookies, pies, pastries, etc.).",
          "If the user asks for non-dessert food, politely refuse and steer back to desserts.",
          "Be step-by-step. Only give ONE step at a time and wait for: next, repeat, how much, substitute X, I'm done.",
          `Studio vibe: ${STUDIO_VIBE}`,
          `Expressive tags allowed: [laughs], [excited], [whispers].`,
          cloneVoiceId
            ? "User has a cloned voice available for narration/timers (handled by the client). Keep your responses short and stepwise."
            : "No cloned voice available yet; keep responses short and stepwise.",
        ].join("\n"),
      );

      await playSfx(`Kitchen ambience, ${STUDIO_SFX_STYLE}`, 1.2);

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
            void playSfx("Soft success chime, elegant sparkle", 0.9);
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
    playSfx,
    status,
    stepIndex,
    stopSession,
    volume,
  ]);

  const micButtonLabel =
    status === "connected"
      ? mode === "speaking"
        ? "Speaking"
        : mode === "listening"
          ? "Listening"
          : "Connected"
      : status === "connecting"
        ? "Connecting"
        : status === "error"
          ? "Error"
          : "Start";

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
    } catch {
      // ignore
    }
  }, [cloneVoiceId, useMyVoiceForNarration]);

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

  const bakeryBackdrop =
    "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=1600&q=80";
  const heroImage =
    activeRecipe?.heroImage ??
    "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1400&q=80";

  const stepTotal = activeRecipe?.steps.length ?? 0;
  const stepPct =
    activeRecipe && stepTotal > 0 ? ((stepIndex + 1) / stepTotal) * 100 : 0;

  return (
    <div className="min-h-screen w-full">
      {/* Hero backdrop */}
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src={bakeryBackdrop}
            alt="Bakery studio"
            fill
            priority
            className="object-cover"
          />
          <Image
            src={heroImage}
            alt="Dessert hero"
            fill
            priority
            className="object-cover opacity-90 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-[color:var(--background)]" />
          <div className="absolute inset-0 bg-[radial-gradient(45%_50%_at_20%_20%,rgba(255,255,255,0.16),transparent_60%),radial-gradient(40%_45%_at_70%_5%,rgba(246,215,222,0.14),transparent_55%)]" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-9 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/70 dark:bg-white/10">
                  <Sparkles className="h-3.5 w-3.5" />
                  Voice-first • Dessert-only
                </Badge>
                {activeRecipe && (
                  <Badge className="bg-white/70 dark:bg-white/10">
                    <Wand2 className="h-3.5 w-3.5" />
                    {activeRecipe.name}
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <ChefMascotMark className="h-11 w-11" />
                <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl">
                  Dessert Dream Baker
                </h1>
              </div>
              <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
                Your hands-free AI pastry chef
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Toggle theme"
                suppressHydrationWarning
                onClick={() =>
                  setTheme((theme ?? "light") === "dark" ? "light" : "dark")
                }
                className="bg-white/70 dark:bg-white/10"
              >
                <Sun className="hidden h-4 w-4 dark:block" />
                <Moon className="block h-4 w-4 dark:hidden" />
              </Button>

              <Button
                variant="secondary"
                onClick={() => setSetupOpen(true)}
                className="bg-white/70 dark:bg-white/10"
              >
                <Command className="h-4 w-4" />
                Studio settings
              </Button>
            </div>
          </div>

          {/* Voice control centerpiece */}
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-col gap-4">
              <Card className="border-white/20 bg-white/10 text-white shadow-none backdrop-blur-md">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white">Voice studio</CardTitle>
                  <CardDescription className="text-white/70">
                    Speak naturally. Say “start cookies”, “next”, “repeat”, or “set a timer…”
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <motion.button
                        type="button"
                        onClick={() =>
                          void (status === "connected" ? stopSession() : startSession())
                        }
                        className={cn(
                          "relative grid h-24 w-24 place-items-center rounded-full border border-white/25 bg-white/10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur",
                          status === "connected" && "bg-white/15",
                        )}
                        whileTap={{ scale: 0.97 }}
                        aria-label="Toggle voice session"
                      >
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={
                            status === "connected"
                              ? { boxShadow: ["0 0 0 0 rgba(246,215,222,0.0)", "0 0 0 22px rgba(246,215,222,0.16)", "0 0 0 0 rgba(246,215,222,0.0)"] }
                              : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
                          }
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <Mic className="h-9 w-9" />
                      </motion.button>

                      {/* Premium waveform */}
                      <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2">
                        <div className="flex items-end gap-1">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <motion.span
                              key={i}
                              className="block w-1.5 rounded-full bg-white/70"
                              animate={{
                                height:
                                  status === "connected"
                                    ? [6, 20, 10, 28, 12, 22][i % 6]
                                    : 6,
                                opacity: status === "connected" ? 1 : 0.45,
                              }}
                              transition={{
                                duration: 0.9,
                                repeat: Infinity,
                                repeatType: "mirror",
                                delay: i * 0.03,
                                ease: "easeInOut",
                              }}
                              style={{ height: 6 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm font-medium text-white">
                        {micButtonLabel}
                      </div>
                      <div className="mt-1 text-xs text-white/70">
                        {status === "connected"
                          ? partial || "Say a dessert request…"
                          : "Tap the mic to begin hands-free mode"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current step (only visible while agent is speaking) */}
              <AnimatePresence>
                {status === "connected" && mode === "speaking" && activeRecipe && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <CardTitle>Current step</CardTitle>
                            <CardDescription>
                              Step {stepIndex + 1} of {stepTotal} •{" "}
                              {activeRecipe.time}
                            </CardDescription>
                          </div>
                          <Badge className="bg-[color:var(--accent)] text-[color:var(--accent-foreground)] border-transparent">
                            Step {stepIndex + 1}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <Progress value={stepPct} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="rounded-2xl border border-[color:var(--border)] bg-white/60 p-4 text-[color:var(--foreground)] dark:bg-white/5">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--sage)]/60 text-sm font-semibold text-[color:var(--foreground)]">
                              {stepIndex + 1}
                            </div>
                            <div className="text-base leading-7">
                              <span>{activeRecipe.steps[stepIndex]}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Voice Shortcuts</CardTitle>
                    <Badge>
                      <Command className="h-3.5 w-3.5" />
                      Hands-free
                    </Badge>
                  </div>
                  <CardDescription>Minimal phrases that just work.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm text-[color:var(--foreground)]">
                    {[
                      ["Start", "“Start chocolate chip cookies”"],
                      ["Step", "“Next” • “Repeat”"],
                      ["Swap", "“Substitute butter”"],
                      ["Timer", "“Set a timer for 10 minutes”"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-white/60 px-3 py-2 dark:bg-white/5"
                      >
                        <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {k}
                        </span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Voice clone</CardTitle>
                  <CardDescription>
                    Optional, but perfect for timers and narration.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl border border-[color:var(--border)] bg-white/60 p-3 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        Use my cloned voice
                      </div>
                      <Switch
                        checked={!!cloneVoiceId && useMyVoiceForNarration}
                        onCheckedChange={(v) => setUseMyVoiceForNarration(!!v)}
                        disabled={!cloneVoiceId}
                        aria-label="Use voice clone"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setSetupOpen(true)}>
                        <Wand2 className="h-4 w-4" />
                        {cloneVoiceId ? "Re-clone" : "Create clone"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setCloneVoiceId(null);
                          try {
                            localStorage.removeItem("ddb.cloneVoiceId");
                          } catch {
                            // ignore
                          }
                        }}
                        disabled={!cloneVoiceId}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Settings / clone modal */}
      <AnimatePresence>
        {setupOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <Card className="bg-[color:var(--background)]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>Studio settings</CardTitle>
                      <CardDescription>
                        Voice clone is optional, but it makes timers delightfully dramatic.
                      </CardDescription>
                    </div>
                    <Button variant="secondary" onClick={() => setSetupOpen(false)}>
                      Done
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-[color:var(--border)] bg-white/60 p-4 dark:bg-white/5">
                      <div className="text-sm font-semibold">Audio</div>
                      <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        Output volume
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="mt-3 w-full"
                        aria-label="Volume"
                      />
                    </div>

                    <div className="rounded-3xl border border-[color:var(--border)] bg-white/60 p-4 dark:bg-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">Voice clone</div>
                          <div className="text-xs text-[color:var(--muted-foreground)]">
                            Record ~15s in a quiet room.
                          </div>
                        </div>
                        <Badge>
                          <Wand2 className="h-3.5 w-3.5" />
                          {cloneVoiceId ? "Ready" : "Optional"}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <input
                          className="h-10 w-full rounded-2xl border border-[color:var(--border)] bg-white/70 px-3 text-sm dark:bg-white/10"
                          value={cloneName}
                          onChange={(e) => setCloneName(e.target.value)}
                          placeholder="Voice name"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              void (cloneStatus === "recording"
                                ? stopRecording()
                                : startRecording())
                            }
                            disabled={cloneStatus === "uploading"}
                          >
                            {cloneStatus === "recording" ? "Stop" : "Record 15s"}
                          </Button>
                          <Button
                            onClick={() => void createClone()}
                            disabled={cloneStatus === "recording" || recordedChunkCount === 0}
                          >
                            {cloneStatus === "uploading" ? "Cloning…" : "Create"}
                          </Button>
                        </div>

                        <div className="text-xs text-[color:var(--muted-foreground)]">
                          {recordedChunkCount ? `${recordedChunkCount} chunks captured` : "No recording yet"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

