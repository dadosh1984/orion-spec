import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangePhase } from "../skills/next/handler.js";

/**
 * Checkpoint store (v0.22, idea #5: resumption for the state machine).
 *
 * think → draft → forge → shield → out is a deterministic state machine.
 * When the process dies mid-wave (OOM, network, closed laptop), the only
 * honest way to resume is to know exactly where it stopped. Every
 * interruptible milestone writes a checkpoint; `orion resume <change-id>`
 * reads it and continues from there (done tasks are skipped via the same
 * forge:slug cache the normal run uses — nothing is re-done, nothing is
 * fabricated).
 *
 * Honesty rules:
 * - checkpoints are a RESUME aid, never a source of truth — the artifacts
 *   (tasks.md, guard-report.json, result.md) stay authoritative, so resume
 *   falls back to artifact inspection when no checkpoint exists;
 * - fail-safe: missing/corrupt checkpoint reads as null, writes never throw.
 */

export interface Checkpoint {
  changeId: string;
  phase: ChangePhase;
  /** Where in the phase we stopped ("wave 2/5", "shield done", …). */
  step: string;
  ts: string;
}

/** State dir (.orion/state under the project; tests override ORION_STATE_DIR). */
export function stateDir(): string {
  return process.env.ORION_STATE_DIR ?? join(process.cwd(), ".orion", "state");
}

export function checkpointPath(changeId: string): string {
  return join(stateDir(), `${changeId}.json`);
}

/** Persist a checkpoint (ts stamped here; never throws). */
export function writeCheckpoint(cp: Omit<Checkpoint, "ts">): void {
  try {
    const p = checkpointPath(cp.changeId);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(
      p,
      JSON.stringify({ ...cp, ts: new Date().toISOString() }, null, 2),
      "utf8",
    );
  } catch {
    /* a checkpoint must never break the workflow */
  }
}

/** Read a checkpoint; missing/corrupt → null (fail-safe). */
export function readCheckpoint(changeId: string): Checkpoint | null {
  try {
    const p = checkpointPath(changeId);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Checkpoint>;
    if (
      typeof raw.changeId !== "string" ||
      typeof raw.phase !== "string" ||
      typeof raw.step !== "string"
    ) {
      return null;
    }
    return raw as Checkpoint;
  } catch {
    return null;
  }
}
