/**
 * Router v2 + Verifier v2 + Scheduler v2 (v0.43).
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { classifyTask } from "./classify.js";

// ─── Router ───────────────────────────────────────────

export interface RouterDecision {
  action:
    | "USE_EXISTING_SKILL"
    | "CREATE_NEW_SKILL"
    | "DIRECT_AI"
    | "ASK_USER"
    | "REJECT";
  skillName?: string;
  confidence: number;
  reason: string;
}

export function findExistingSkill(
  prompt: string,
): { name: string; score: number } | null {
  const dir = join(homedir(), ".orion", "scripts");
  if (!existsSync(dir)) return null;
  const words = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let best: { name: string; score: number } | null = null;
  try {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const mf = join(dir, d.name, "orion.json");
      if (!existsSync(mf)) continue;
      try {
        const m = JSON.parse(readFileSync(mf, "utf8")) as {
          name: string;
          description: string;
        };
        let score = 0;
        const desc = (m.description || "").toLowerCase();
        for (const w of words) {
          if (d.name.includes(w)) score += 3;
          if (desc.includes(w)) score += 1;
        }
        if (score > 0 && (!best || score > best.score))
          best = { name: d.name, score };
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return best;
}

export function routeRequest(prompt: string): RouterDecision {
  const existing = findExistingSkill(prompt);
  if (existing && existing.score >= 5) {
    return {
      action: "USE_EXISTING_SKILL",
      skillName: existing.name,
      confidence: Math.min(0.9, existing.score / 10),
      reason: `Found matching skill "${existing.name}" (score: ${existing.score}).`,
    };
  }
  const cat = classifyTask(prompt);
  if (cat.category <= 3)
    return {
      action: "CREATE_NEW_SKILL",
      confidence: 0.8,
      reason: `${cat.label}. ${cat.reason}`,
    };
  if (cat.category === 4)
    return {
      action: "CREATE_NEW_SKILL",
      confidence: 0.6,
      reason: `${cat.label}. ${cat.reason}`,
    };
  return { action: "DIRECT_AI", confidence: 0.9, reason: cat.reason };
}

// ─── Verifier v2 ──────────────────────────────────────

export interface Postcondition {
  type: "json_field" | "metric" | "file_exists";
  field?: string;
  equals?: unknown;
  path?: string;
  min?: number;
}

export interface VerifyResult {
  ok: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
}

export function verifyRun(
  stdout: string,
  postconditions?: Postcondition[],
): VerifyResult {
  const checks: VerifyResult["checks"] = [];
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    /* ok */
  }
  for (const pc of postconditions ?? []) {
    if (pc.type === "json_field" && parsed) {
      const val = parsed[pc.field!];
      const passed = val === pc.equals;
      checks.push({
        name: `json_field ${pc.field} == ${JSON.stringify(pc.equals)}`,
        passed,
        detail: passed
          ? "ok"
          : `expected ${JSON.stringify(pc.equals)}, got ${JSON.stringify(val)}`,
      });
    } else if (pc.type === "metric" && parsed?.metrics) {
      const m = parsed.metrics as Record<string, number>;
      const val = m[pc.field!];
      const passed = typeof val === "number" && val >= (pc.min ?? 0);
      checks.push({
        name: `metric ${pc.field} >= ${pc.min}`,
        passed,
        detail: passed ? "ok" : `${pc.field}=${val}, min=${pc.min}`,
      });
    } else if (pc.type === "file_exists") {
      const p = pc.path ?? "";
      const passed = existsSync(p);
      checks.push({
        name: `file_exists ${p}`,
        passed,
        detail: passed ? "exists" : "not found",
      });
    }
  }
  return { ok: checks.every((c) => c.passed), checks };
}

// ─── Scheduler v2: file watchers ──────────────────────

const WATCHER_REGISTRY = join(homedir(), ".orion", "watchers.json");

interface WatcherEntry {
  name: string;
  watchDir: string;
  pattern: string;
  skillName: string;
  createdAt: string;
}

function readWatchers(): WatcherEntry[] {
  try {
    if (!existsSync(WATCHER_REGISTRY)) return [];
    return JSON.parse(readFileSync(WATCHER_REGISTRY, "utf8")) as WatcherEntry[];
  } catch {
    return [];
  }
}

function writeWatchers(entries: WatcherEntry[]): void {
  mkdirSync(dirname(WATCHER_REGISTRY), { recursive: true });
  writeFileSync(WATCHER_REGISTRY, JSON.stringify(entries, null, 2), "utf8");
}

export function addFileWatcher(
  name: string,
  watchDir: string,
  pattern: string,
  skillName: string,
): WatcherEntry {
  const entries = readWatchers().filter((e) => e.name !== name);
  const entry: WatcherEntry = {
    name,
    watchDir,
    pattern,
    skillName,
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  writeWatchers(entries);
  return entry;
}

export function removeFileWatcher(name: string): void {
  writeWatchers(readWatchers().filter((e) => e.name !== name));
}

export function listWatchers(): WatcherEntry[] {
  return readWatchers();
}
