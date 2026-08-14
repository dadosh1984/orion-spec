/**
 * `orion memory` (B2) — one logical group for the state the pipeline keeps.
 *
 * A facade over the existing per-domain commands, NOT a new source of truth:
 * it assembles a single "memory" view from the modules that already own that
 * state (profile, cache/track, lessons, metrics, env). Keeps the 8 top-level
 * commands intact — `memory` is one more grouped view, not a 9th orthogonal
 * feature, and the existing commands stay as direct aliases.
 */

import { statusMark, paint } from "../utils/term.js";
import { profilePath, readProfile } from "../core/profile.js";
import { OrionTrack } from "../core/track.js";
import { readLessons } from "../core/lessons.js";
import { envCmd } from "./envCmd.js";

/** Memory components every sub-command observes. */
export interface MemorySummary {
  profile: { exists: boolean; lang: string; platform: string; budget: string };
  cache: { entries: number; bytes: number };
  lessons: number;
  envVars: number;
  metrics: { cachedSaves: string };
}

/** Build the compact memory overview from the real state sources. */
export async function memorySummary(track: OrionTrack): Promise<MemorySummary> {
  const prof = readProfile();
  return {
    profile: {
      exists: Boolean(profilePath()),
      lang: prof.language ?? "unset",
      platform: prof.platform ?? "unset",
      budget: prof.budget ?? "unset",
    },
    cache: { entries: track.getStats().count, bytes: track.getStats().size },
    lessons: readLessons().length,
    envVars: Object.keys(process.env).filter((k) => k.startsWith("ORION_"))
      .length,
    metrics: { cachedSaves: `${track.getStats().size} B cache` },
  };
}

/** Print the human-readable memory overview. */
export function formatMemorySummary(m: MemorySummary): string {
  const rows: string[] = [
    `${statusMark("info")} Orion memory (state the pipeline keeps):`,
    "",
    `  ${paint("profile:", "dim")}  ${m.profile.exists ? m.profile.lang : "not created"} (language=${m.profile.lang}, platform=${m.profile.platform}, budget=${m.profile.budget})`,
    `  ${paint("cache:", "dim")}    ${m.cache.entries} ${m.cache.entries === 1 ? "entry" : "entries"}, ${m.cache.bytes} B`,
    `  ${paint("lessons:", "dim")}  ${m.lessons} recorded`,
    `  ${paint("env:", "dim")}     ${m.envVars} ORION_* variable(s)`,
    `  ${paint("metrics:", "dim")} ${m.metrics.cachedSaves}`,
  ];
  return rows.join("\n");
}

/** `orion memory [cache|lessons|env|profile]` — grouped state view. */
export async function memoryHandler(
  track: OrionTrack,
  args: string[],
): Promise<number> {
  const sub = args[0];
  if (!sub || sub.startsWith("-")) {
    console.log(formatMemorySummary(await memorySummary(track)));
    return 0;
  }
  if (sub === "cache") {
    const s = track.getStats();
    console.log(
      `cache: ${s.count} ${s.count === 1 ? "entry" : "entries"}, ${s.size} B`,
    );
    return 0;
  }
  if (sub === "lessons") {
    const all = readLessons();
    console.log(`lessons: ${all.length} recorded`);
    for (const l of all.slice(0, 8)) {
      console.log(
        `  ${l.changeId ?? "?"} ${l.step ?? ""} — ${String(l.error ?? "").slice(0, 60)}`,
      );
    }
    if (all.length > 8) console.log(`  … and ${all.length - 8} more`);
    return 0;
  }
  if (sub === "env") {
    const e = envCmd();
    console.log(e.text);
    return 0;
  }
  if (sub === "profile") {
    const prof = readProfile();
    console.log(
      `profile: ${prof.language ?? "unset"} language, platform=${prof.platform ?? "unset"}, budget=${prof.budget ?? "unset"}`,
    );
    return 0;
  }
  console.log(
    `${statusMark("warn")} memory: unknown sub-command "${sub}" — try: cache | lessons | env | profile`,
  );
  return 1;
}
