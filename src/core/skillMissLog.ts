/**
 * Skill miss-log (v0.51) — Phase 1 mandatory infrastructure.
 *
 * Every step that does NOT get a confident skill match is logged: the step
 * text, the domain, what the reigistry DID contain, and (once known) what
 * the LLM ended up doing for that step. Without this log you cannot tune
 * BM25 thresholds, nor find promotion candidates — so it ships on day one,
 * before any matching polish.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

export interface SkillMissEntry {
  ts: string;
  step: string;
  domain: string;
  /** Why no match: no-skills | below-threshold | borderline (sent to LLM verify). */
  reason: "no-skills" | "below-threshold" | "borderline";
  /** Top candidate score (best effort), null if registry empty. */
  topScore: number | null;
  /** What the step became/resulted in (filled by the caller after LLM run). */
  resolution?: string;
}

let _logPath: string | null = null;
export function missLogFile(): string {
  if (_logPath) return _logPath;
  const dir = process.env.ORION_MISS_LOG_DIR ?? join(homedir(), ".orion");
  _logPath = join(dir, "skill-miss-log.jsonl");
  return _logPath;
}

/** Read all logged misses as parsed entries (appends are JSONL-safe). */
export function readMissLog(): SkillMissEntry[] {
  const f = missLogFile();
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try {
        return JSON.parse(l) as SkillMissEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is SkillMissEntry => e !== null);
}

/** Append one miss to the log (single-file JSONL append — atomic enough). */
export function logSkillMiss(entry: Omit<SkillMissEntry, "ts">): void {
  const f = missLogFile();
  if (!existsSync(f)) mkdirSync(join(f, ".."), { recursive: true });
  const rec: SkillMissEntry = { ts: new Date().toISOString(), ...entry };
  // Read-modify-write to keep one JSON per line (string >= ~64 bytes; a
  // straight append is fine but Windows newlines must be consistent).
  try {
    writeFileSync(f, JSON.stringify(rec) + "\n", { flag: "a" });
  } catch {
    /* non-fatal: logging must never break the workflow */
  }
}

/** Find repeated step signatures in the log — candidatetes for promotion. */
export function promotionCandidates(minRepeats = 3): Array<{
  repeat: number;
  entry: SkillMissEntry;
}> {
  const entries = readMissLog();
  const byStep = new Map<string, SkillMissEntry[]>();
  for (const e of entries) {
    const key = e.step.trim().toLowerCase();
    const arr = byStep.get(key) ?? [];
    arr.push(e);
    byStep.set(key, arr);
  }
  const out: Array<{ repeat: number; entry: SkillMissEntry }> = [];
  for (const [, arr] of byStep) {
    if (arr.length >= minRepeats) {
      out.push({ repeat: arr.length, entry: arr[arr.length - 1] });
    }
  }
  return out.sort((a, b) => b.repeat - a.repeat);
}
