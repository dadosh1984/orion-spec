/**
 * Router v2 + Verifier v2 + Scheduler v2 (v0.43).
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { classifyTask } from "./classify.js";
import { classifyComplexity } from "../skills/think/complexity.js";
import { matchSkill, resolveDomain } from "./skillsMatch.js";

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

export function routeRequest(prompt: string): RouterDecision {
  // Unified matching path (v0.51): BM25 `matchSkill`, same as `orion run
  // match`. Old naive `findExistingSkill` had a separate threshold (score >= 5)
  // and no IDF — two matchers would pick different skills for the same step.
  // `ambiguous` is NOT auto-resolved here: a short-list for the LLM one layer
  // up (error asymmetry — never guess). Only a confident `matched` is used.
  const m = matchSkill(prompt, { domain: resolveDomain() });
  if (m.kind === "matched") {
    return {
      action: "USE_EXISTING_SKILL",
      skillName: m.skill.name,
      confidence: m.tier === "exact" ? 0.95 : Math.min(0.8, 0.3 + m.score),
      reason: `Found matching skill "${m.skill.name}" (tier=${m.tier}, score=${m.score.toFixed(2)}).`,
    };
  }
  const cat = classifyTask(prompt);
  if (cat.category === 6)
    return {
      action: "REJECT",
      confidence: 0.95,
      reason: `${cat.label}. ${cat.reason}`,
    };
  // «Eat an elephant» gate: abstract (non-executable) prompts are not a
  // deliverable — answer directly, never send through forge/decomposition.
  if (classifyComplexity(prompt).complexity === "abstract") {
    return {
      action: "DIRECT_AI",
      confidence: 0.9,
      reason: `Abstract prompt (complexity=abstract) — answer directly, no forge.`,
    };
  }
  if (cat.category <= 3)
    return {
      action: "CREATE_NEW_SKILL",
      confidence: 0.8,
      reason: `${cat.label}. ${cat.reason}`,
    };
  if (cat.category === 4)
    return {
      action: "ASK_USER",
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
