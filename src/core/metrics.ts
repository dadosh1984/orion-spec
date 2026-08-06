import { performance } from "node:perf_hooks";
import { statSync } from "node:fs";
import { applyScale, previewScale } from "./scale.js";
import {
  estimateTokens,
  economyStats,
  type ProjectEconomy,
} from "./compress.js";
import type { OrionTrack } from "./track.js";

export { estimateTokens } from "./compress.js";

/** Timing of a single benchmark pass over the whole ladder. */
export interface PassTiming {
  pass: "cold" | "hot";
  durationMs: number;
}

/** Per-stage breakdown from a single cold run. */
export interface StageTiming {
  stage: string;
  changed: boolean;
  durationMs: number;
}

/** Token-budget estimate for one cache namespace. */
export interface NamespaceBudget {
  namespace: string;
  bytes: number;
  tokens: number;
  /** Fraction of the total budget, 0..1. */
  share: number;
}

/** The full metrics report (per-step timings + token budget + economy). */
export interface MetricsReport {
  version: string;
  timings: PassTiming[];
  stages: StageTiming[];
  budget: NamespaceBudget[];
  totalTokens: number;
  cached: { count: number; bytes: number };
  /** Token-economy ledger (v0.11): real measured savings from compress ops. */
  economy: {
    entries: number;
    savedBytes: number;
    savedTokens: number;
    byProject: ProjectEconomy[];
  };
}

/** Rough token estimate: ~4 bytes per token (BPE heuristic). */
// (source of truth lives in src/core/compress.ts; re-exported for callers)

/** Reference snippet that exercises every ladder stage. */
const BENCHMARK_SNIPPET = [
  "import { readFileSync } from 'fs';",
  "// benchmark comment",
  "console.log(readFileSync('a.txt'));",
  "export const add = (a, b) => { return a + b; };",
  "",
].join("\n");

/**
 * Run the ladder twice: once bypassing the cache ("cold", recomputes every
 * stage) and once hitting cached results ("hot"). Also returns a per-stage
 * breakdown from one cold pass (wall time split evenly across stages).
 */
export async function runBenchmark(track: OrionTrack): Promise<{
  timings: PassTiming[];
  stages: StageTiming[];
}> {
  // Warm the cache so the "hot" pass reads every stage from OrionTrack.
  await applyScale(BENCHMARK_SNIPPET, { track });

  const coldStart = performance.now();
  await applyScale(BENCHMARK_SNIPPET, { noCache: true, track });
  const coldMs = performance.now() - coldStart;

  const hotStart = performance.now();
  await applyScale(BENCHMARK_SNIPPET, { track });
  const hotMs = performance.now() - hotStart;

  // Per-stage breakdown from one cold pass.
  const stageStart = performance.now();
  const preview = await previewScale(BENCHMARK_SNIPPET);
  const span = Math.max(0.0001, performance.now() - stageStart);
  const stages: StageTiming[] = preview.stages.map((s) => ({
    stage: s.name,
    changed: s.changed,
    durationMs: span / preview.stages.length,
  }));

  return {
    timings: [
      { pass: "cold", durationMs: Math.round(coldMs * 100) / 100 },
      { pass: "hot", durationMs: Math.round(hotMs * 100) / 100 },
    ],
    stages,
  };
}

/** Group cached keys by namespace and estimate the token budget per one. */
export function tokenBudget(track: OrionTrack): NamespaceBudget[] {
  const groups = new Map<string, { bytes: number }>();
  for (const key of track.keys()) {
    const namespace = key.includes(":") ? key.slice(0, key.indexOf(":")) : key;
    let size = 0;
    try {
      size = statSync(track.entryPath(key)).size;
    } catch {
      /* best effort */
    }
    const group = groups.get(namespace) ?? { bytes: 0 };
    group.bytes += size;
    groups.set(namespace, group);
  }
  const totalBytes = [...groups.values()].reduce((sum, g) => sum + g.bytes, 0);
  const budget = [...groups.entries()].map(([namespace, { bytes }]) => ({
    namespace,
    bytes,
    tokens: estimateTokens(bytes),
    share: totalBytes > 0 ? bytes / totalBytes : 0,
  }));
  budget.sort((a, b) => b.bytes - a.bytes);
  return budget;
}

/** Render a single ASCII bar (proportional to max). */
export function asciiBar(value: number, max: number, width = 20): string {
  if (max <= 0) return "".padEnd(width, "░");
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

/** Compose the full report: benchmark timings + cache token budget. */
export async function metricsReport(
  track: OrionTrack,
  version: string,
): Promise<MetricsReport> {
  const { timings, stages } = await runBenchmark(track);
  const budget = tokenBudget(track);
  const stats = track.getStats();
  return {
    version,
    timings,
    stages,
    budget,
    totalTokens: budget.reduce((sum, b) => sum + b.tokens, 0),
    cached: { count: stats.count, bytes: stats.size },
    economy: economyStats(),
  };
}
