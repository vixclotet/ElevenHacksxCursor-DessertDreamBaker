#!/usr/bin/env node
/**
 * Reads `.env.local` and pushes selected keys to Vercel (production + preview)
 * using the Vercel CLI. Run from repo root: `node scripts/push-env-to-vercel.mjs`
 *
 * Prereqs: `vercel link`, `vercel login`, and a filled `.env.local`.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

const KEYS_TO_SYNC = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_TTS_VOICE_ID",
  "ELEVENLABS_BASE_URL",
];

const TARGET_ENVS = ["production", "preview"];

function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function vercelEnvAdd(name, environment, value) {
  const args = [
    "vercel",
    "env",
    "add",
    name,
    environment,
    "--value",
    value,
    "--yes",
    "--sensitive",
    "--force",
  ];
  const r = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (r.status !== 0 && r.status !== null) {
    process.exit(r.status);
  }
}

if (!existsSync(envPath)) {
  console.error(
    "Missing .env.local — copy .env.example to .env.local and add real values, then run again.",
  );
  process.exit(1);
}

const vars = parseEnvFile(readFileSync(envPath, "utf8"));
let count = 0;

for (const key of KEYS_TO_SYNC) {
  const value = vars[key];
  if (value === undefined || value === "") {
    console.log(`Skip ${key} (empty or missing)`);
    continue;
  }
  if (key === "ELEVENLABS_API_KEY" && value.startsWith("your_")) {
    console.warn(`Skip ${key} — still a placeholder in .env.local`);
    continue;
  }
  for (const env of TARGET_ENVS) {
    console.log(`→ ${key} → ${env}`);
    vercelEnvAdd(key, env, value);
    count += 1;
  }
}

console.log(`Done. Updated ${count} Vercel env slot(s). Redeploy for functions to pick up changes.`);
