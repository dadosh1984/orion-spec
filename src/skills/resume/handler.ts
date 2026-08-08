import { existsSync, readFileSync } from "node:fs";
import { readCheckpoint, writeCheckpoint } from "../../core/checkpoint.js";
import { readTasks } from "../forge/handler.js";
import { draft } from "../draft/handler.js";
import { forgeParallel } from "../forge/handler.js";
import { shield } from "../shield/handler.js";
import { out } from "../out/handler.js";
import type { ChangePhase } from "../next/handler.js";

/**
 * `orion resume <change-id>` — continue an interrupted workflow (v0.22).
 *
 * If a checkpoint exists (written after each forge wave / shield / out) it
 * tells us exactly where we stopped; otherwise the artifacts themselves are
 * the truth and resume derives the phase from them (result.md > guard
 * report > open tasks > proposal). The phase's skill is then executed with
 * the normal machinery, so already-done tasks are skipped via the same
 * forge:slug cache a fresh run would use — nothing is re-done, nothing is
 * fabricated as done.
 */

export interface ResumeResult {
  changeId: string;
  phase: ChangePhase;
  resumedFrom: "checkpoint" | "artifacts";
  step: string;
  outcome: string;
}

/** Injectable executors so unit tests never run real builds. */
export interface ResumeHooks {
  draft?: (id: string) => Promise<unknown>;
  forge?: (id: string) => Promise<unknown>;
  shield?: (id: string) => Promise<unknown>;
  out?: (id: string) => Promise<unknown>;
}

const DEFAULT_HOOKS: ResumeHooks = {
  draft: async (id) => await draft(id, { noCache: true }),
  forge: async (id) => await forgeParallel(id, { noCache: true }),
  shield: async (id) => await shield(id, { noCache: true }),
  out: async (id) => await out(id, { noCache: true }),
};

/** Derive the phase from the authoritative artifacts (no checkpoint). */
export function detectPhase(changeId: string): ChangePhase {
  if (existsSync(`changes/${changeId}/result.md`)) return "done";
  if (existsSync(`reports/${changeId}/guard-report.json`)) {
    try {
      const g = JSON.parse(
        readFileSync(`reports/${changeId}/guard-report.json`, "utf8"),
      ) as { allPass?: boolean };
      return g.allPass ? "out" : "shield";
    } catch {
      return "shield";
    }
  }
  if (existsSync(`changes/${changeId}/tasks.md`)) {
    return readTasks(changeId).some((t) => !t.done) ? "forge" : "shield";
  }
  if (existsSync(`changes/${changeId}/proposal.json`)) return "draft";
  throw new Error(
    `change "${changeId}" not found under changes/ — run "orion think ..." first`,
  );
}

export async function resume(
  changeId: string,
  hooks: ResumeHooks = DEFAULT_HOOKS,
): Promise<ResumeResult> {
  const cp = readCheckpoint(changeId);
  const phase: ChangePhase = cp?.phase ?? detectPhase(changeId);
  const step = cp?.step ?? "derived from artifacts";

  const run = hooks[phase as keyof ResumeHooks];
  if (!run) {
    throw new Error(
      phase === "done"
        ? `resume: change "${changeId}" is already done — nothing to resume`
        : `resume: no executor for phase "${phase}"`,
    );
  }
  const result = await run(changeId);
  const summary = String(
    (result as { message?: string })?.message ??
      (result as { detail?: string })?.detail ??
      "ok",
  );

  if (phase !== "done") {
    writeCheckpoint({ changeId, phase, step: `${step} — resumed ok` });
  }

  return {
    changeId,
    phase,
    resumedFrom: cp ? "checkpoint" : "artifacts",
    step,
    outcome: summary,
  };
}
