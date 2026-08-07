import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Observability trace store (v0.22, idea: zero-dep OTLP JSONL export).
 *
 * When ORION_TELEMETRY=1 every state-machine transition, cache hit and TDD
 * cycle is appended as one JSON line to ~/.orion/traces.jsonl — the raw
 * material for dashboards ("mean time per RED-GREEN", "cache-hit ratio").
 *
 * Honesty rules:
 * - opt-in only: with the env var unset this module is a pure no-op;
 * - append-only, fail-safe: a broken or unwritable trace file must never
 *   crash the caller — telemetry is a by-product, not a dependency;
 * - zero dependencies: one JSON line per event, no OTLP protobuf machinery.
 */

/** Trace file path (~/.orion/traces.jsonl; tests override via ORION_TRACES_FILE). */
export function tracesPath(): string {
  return (
    process.env.ORION_TRACES_FILE ?? join(homedir(), ".orion", "traces.jsonl")
  );
}

/** Telemetry is strictly opt-in (ORION_TELEMETRY=1). */
export function telemetryEnabled(): boolean {
  return process.env.ORION_TELEMETRY === "1";
}

/** A single trace event (ts is stamped by `trace`, never trusted from callers). */
export interface TraceEvent {
  type: string;
  ts: string;
  [key: string]: unknown;
}

/**
 * Record one event as a JSON line. No-op unless ORION_TELEMETRY=1; never
 * throws — telemetry failure must not break the workflow.
 */
export function trace(event: Omit<TraceEvent, "ts">): void {
  if (!telemetryEnabled()) return;
  try {
    const line = `${JSON.stringify({ ...event, ts: new Date().toISOString() })}\n`;
    const p = tracesPath();
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, line, "utf8");
  } catch {
    /* fail-safe: telemetry is a by-product, not a dependency */
  }
}

/** Read recorded events; missing/corrupt file → [] (fail-safe). */
export function readTraces(): TraceEvent[] {
  try {
    const p = tracesPath();
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l) as TraceEvent;
        } catch {
          return null;
        }
      })
      .filter((x): x is TraceEvent => x !== null);
  } catch {
    return [];
  }
}
