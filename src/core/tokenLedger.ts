/**
 * Token Ledger (v0.41) — token accounting and skill ROI.
 *
 * Every `orion run` records a TokenEvent.
 * skillMetrics aggregates per-skill statistics.
 *
 * The ledger lives in ~/.orion/token-events.json + ~/.orion/skill-metrics.json.
 * No external dependencies.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TokenEvent {
  id: string;
  ts: string;
  skillName: string;
  /** "run" | "create" | "repair" | "direct_ai" */
  mode: "run" | "create" | "repair" | "direct_ai";
  /** Tokens spent on this call (0 for a run without LLM). */
  tokensIn: number;
  /** Tokens saved vs a direct LLM run. */
  tokensSaved: number;
  /** Estimated cost of a direct LLM run in tokens. */
  baselineTokens: number;
  /** success | error | hazard_blocked | validation_failed */
  status: "success" | "error" | "hazard_blocked" | "validation_failed";
  durationMs: number;
}

export interface SkillMetric {
  skillName: string;
  runs: number;
  successRuns: number;
  failedRuns: number;
  /** Tokens spent creating the skill. */
  creationTokens: number;
  /** Tokens spent on repair. */
  repairTokens: number;
  /** Average token saving per run. */
  avgTokensSavedPerRun: number;
  /** Total token savings. */
  totalTokensSaved: number;
  /** Net savings (saved − creation − repair). */
  netTokensSaved: number;
  /** ROI: netTokensSaved / (creationTokens + repairTokens). */
  roiScore: number;
  lastUsedAt: string;
}

const MAX_EVENTS = 1000;

function ledgerDir(): string {
  return process.env.ORION_LEDGER_DIR ?? join(homedir(), ".orion");
}

function eventsPath(): string {
  return join(ledgerDir(), "token-events.json");
}

function metricsPath(): string {
  return join(ledgerDir(), "skill-metrics.json");
}

function readEvents(): TokenEvent[] {
  try {
    const p = eventsPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as TokenEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: TokenEvent[]): void {
  const dir = ledgerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    eventsPath(),
    JSON.stringify(events.slice(-MAX_EVENTS), null, 2),
    "utf8",
  );
}

function readMetrics(): SkillMetric[] {
  try {
    const p = metricsPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as SkillMetric[];
  } catch {
    return [];
  }
}

function writeMetrics(metrics: SkillMetric[]): void {
  const dir = ledgerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(metricsPath(), JSON.stringify(metrics, null, 2), "utf8");
}

/** Record a single event. */
export function recordTokenEvent(event: Omit<TokenEvent, "id" | "ts">): void {
  const events = readEvents();
  events.push({
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
  });
  writeEvents(events);
}

/** Update the skill metrics after a run. */
export function updateSkillMetrics(
  skillName: string,
  run: {
    success: boolean;
    tokensSaved: number;
    durationMs: number;
    mode: TokenEvent["mode"];
    tokensIn: number;
  },
): SkillMetric {
  const metrics = readMetrics();
  let m = metrics.find((x) => x.skillName === skillName);
  if (!m) {
    m = {
      skillName,
      runs: 0,
      successRuns: 0,
      failedRuns: 0,
      creationTokens: 0,
      repairTokens: 0,
      avgTokensSavedPerRun: 0,
      totalTokensSaved: 0,
      netTokensSaved: 0,
      roiScore: 0,
      lastUsedAt: "",
    };
    metrics.push(m);
  }

  m.runs++;
  if (run.success) m.successRuns++;
  else m.failedRuns++;

  if (run.mode === "create") m.creationTokens += run.tokensIn;
  if (run.mode === "repair") m.repairTokens += run.tokensIn;

  m.totalTokensSaved += run.tokensSaved;
  m.netTokensSaved = m.totalTokensSaved - m.creationTokens - m.repairTokens;
  m.avgTokensSavedPerRun =
    m.runs > 0 ? Math.round(m.totalTokensSaved / m.runs) : 0;
  m.roiScore =
    m.creationTokens + m.repairTokens > 0
      ? Math.round(
          (m.netTokensSaved / (m.creationTokens + m.repairTokens)) * 100,
        ) / 100
      : m.totalTokensSaved > 0
        ? Infinity
        : 0;
  m.lastUsedAt = new Date().toISOString();

  writeMetrics(metrics);
  return m;
}

/** Get metrics for all skills. */
export function getSkillMetrics(): SkillMetric[] {
  return readMetrics().sort((a, b) => b.totalTokensSaved - a.totalTokensSaved);
}

/** Get metrics for one skill. */
export function getSkillMetric(name: string): SkillMetric | null {
  return readMetrics().find((m) => m.skillName === name) ?? null;
}

/** Last N events. */
export function getRecentEvents(n = 20): TokenEvent[] {
  return readEvents().slice(-n).reverse();
}

/** Aggregate statistics. */
export function tokenSummary(): {
  totalEvents: number;
  totalSaved: number;
  totalRuns: number;
  skillCount: number;
} {
  const events = readEvents();
  const metrics = readMetrics();
  return {
    totalEvents: events.length,
    totalSaved: metrics.reduce((s, m) => s + m.totalTokensSaved, 0),
    totalRuns: metrics.reduce((s, m) => s + m.runs, 0),
    skillCount: metrics.length,
  };
}

/** Baseline token estimate for a direct LLM run (heuristic). */
export function estimateBaselineTokens(promptLength: number): number {
  // ~1 token per 4 chars for system + user + response
  const systemOverhead = 200;
  const responseOverhead = 300;
  return systemOverhead + Math.ceil(promptLength / 4) + responseOverhead;
}
