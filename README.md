# ElevenHacksxCursor-DessertDreamBaker

## Overview

![Dessert Dream Baker — Voice studio UI over a bakery backdrop](docs/app-overview.png)

**Dessert Dream Baker** is a hands-free AI pastry chef for the Cursor × ElevenLabs Hackathon. The UI is built around **Voice studio**: tap once to connect the mic, then speak naturally for recipes, demos, timers, and shortcuts—while **Voice shortcuts** lists phrases you can say without touching the screen (messy hands, gloves mode, settings, and more). Under the hood it combines ElevenLabs **Agents**, **Scribe** realtime speech-to-text, **TTS**, and **sound effects** for a luxury “baking studio” feel.

🍪 Talk through cakes, cookies, pies, and no-bake treats with real-time guidance—no typing, just voice while your hands are covered in flour.

## ✨ Key Features

Natural Voice Conversations — Say things like "Walk me through chocolate chip cookies with what I have" or "Is it golden yet?"
Real-time Smart Adjustments — Ingredient substitutions, oven temp conversions, dietary swaps, and doneness checks
Dramatic ElevenLabs Audio Experience:
Expressive TTS (Flash v2.5 + v3)
Instant voice cloning (your voice or a fun chef/grandma persona)
Rich sound effects — mixer whirring, butter sizzling, oven dings, celebratory sparkles

Step-by-step guidance with interruptions, repeats, and timer announcements
Delightful & Kitchen-Friendly UI (but fully usable eyes-closed)

## 🛠 Built With

Cursor (AI-first coding)
ElevenLabs (Agents + Scribe STT + Streaming TTS + Sound Effects + Voice Cloning)
Next.js 15 + TypeScript + Tailwind
Fully voice-first architecture

## 🎯 Hackathon Goal
Created as an entry for Cursor × ElevenLabs Hackathon to showcase the full power of voice AI in the kitchen — making baking fun, accessible, and truly hands-free.

## 🚀 Run locally

### Prereqs

- Node.js 20+
- An ElevenLabs API key
- An ElevenLabs **Conversational AI Agent** (Agent ID)

### Setup

1) Install dependencies

```bash
npm install
```

2) Configure env vars

```bash
cp .env.example .env.local
```

Set these in `.env.local`:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

Optional:

- `ELEVENLABS_BASE_URL` (use if you’re on a residency base URL)

3) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`, press **Start (Hands-free)**, grant microphone access, and talk naturally.

## 🧠 How the voice loop works (core)

- **Scribe v2 Realtime (STT)**: browser microphone → live partial transcript → committed transcript
- **ElevenLabs Agents (brain + voice output)**: committed transcript is sent to the agent as a user message
- **Sound Effects API**: UI triggers sound effects at key “baking moments” (mixing, oven, butter, etc.)

Server routes:

- `GET /api/eleven/agent-signed-url` → signed URL for private Agents WebSocket/WebRTC session
- `GET /api/eleven/scribe-token` → single-use token for Scribe realtime
- `POST /api/eleven/sound-effect` → generate SFX audio from a prompt

## 🔐 Security

Your ElevenLabs API key stays server-side only. The browser receives:

- a **signed URL** for Agents
- a **single-use token** for Scribe

## Next steps (planned)

- Voice cloning onboarding (record 10–20s → create voice → use as persona)
- Dessert recipe memory + substitutions DB + step state machine
- Dramatic timers + countdown SFX choreography
