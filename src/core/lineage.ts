/**
 * Lineage primitives (v0.56, tasks 2.5 + 4.5) — explicit, honest provenance.
 *
 * Principle (accepted): a lesson "influenced" a change IFF the user EXPLICITLY
 * applied it (`orion memory lessons apply <id> --to <change>`). Heuristics
 * (keyword/domain hints in `orion new`) are suggestions, NEVER recorded as
 * influence — otherwise lineage would lie and the honesty pyramid falls.
 *
 * Data model:
 *   proposal.json  += borrowedLessons: [{ lessonId, appliedAt, note? }]
 *   lesson.json    += sourceChange: string|null  (born-from change, if any)
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { readLessons } from "./lessons.js";

export interface BorrowedLesson {
  lessonId: string;
  appliedAt: string;
  note?: string;
}

/** Read the borrowed-effects recorded on a change's proposal ([] if none). */
export function readBorrowedLessons(changeId: string): BorrowedLesson[] {
  const f = `changes/${changeId}/proposal.json`;
  if (!existsSync(f)) return [];
  try {
    const p = JSON.parse(readFileSync(f, "utf8")) as {
      borrowedLessons?: unknown;
    };
    return Array.isArray(p.borrowedLessons)
      ? (p.borrowedLessons as BorrowedLesson[])
      : [];
  } catch {
    return [];
  }
}

/** Does a lesson with this id exist? Honest guard — we never apply a phantom. */
export function lessonExists(lessonId: string): boolean {
  return readLessons().some((l) => l.id === lessonId);
}

/**
 * Apply a lesson to a change: record an explicit borrowedLessons entry in
 * proposal.json. Read-only-checked: the change + lesson must exist, and the
 * same lesson isn't double-applied (idempotent). Never adds a rating on its
 * own — applying is the user's explicit act.
 */
export function applyLesson(
  changeId: string,
  lessonId: string,
  note?: string,
): { ok: boolean; reason?: string } {
  const propPath = `changes/${changeId}/proposal.json`;
  if (!existsSync(propPath))
    return { ok: false, reason: `no changes/${changeId}/proposal.json` };
  if (!lessonExists(lessonId))
    return { ok: false, reason: `lesson "${lessonId}" not found` };

  const existing = readBorrowedLessons(changeId);
  if (existing.some((b) => b.lessonId === lessonId)) {
    return { ok: true, reason: "already applied (idempotent)" };
  }
  const entry: BorrowedLesson = {
    lessonId,
    appliedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
  try {
    const p = JSON.parse(readFileSync(propPath, "utf8")) as Record<
      string,
      unknown
    >;
    const borrowed = existing.concat(entry);
    p.borrowedLessons = borrowed;
    writeFileSync(propPath, JSON.stringify(p, null, 2), "utf8");
    return { ok: true };
  } catch {
    return { ok: false, reason: "proposal.json unreadable/corrupt" };
  }
}

// --- 4.5 lineage: explicit provenance walk --------------------------------

/** The change a lesson was born from (lessons.json sourceChange), if recorded. */
export function lessonSourceChange(lessonId: string): string | null {
  return readLessons().find((l) => l.id === lessonId)?.sourceChange ?? null;
}

/** All changes that explicitly borrowed this lesson (proposal.borrowedLessons). */
export function appliedTo(lessonId: string): string[] {
  if (!lessonExists(lessonId)) return [];
  const out: string[] = [];
  const base = "changes";
  if (!existsSync(base)) return out;
  // Scan every change dir's proposal for a borrowedLessons entry matching.
  for (const id of readdirSync(base)) {
    if (readBorrowedLessons(id).some((b) => b.lessonId === lessonId))
      out.push(id);
  }
  return out.sort();
}

/** Full lessons born from a given change (their sourceChange === changeId). */
function lessonsBornFrom(changeId: string): string[] {
  return readLessons()
    .filter((l) => l.sourceChange === changeId)
    .map((l) => l.id);
}

export interface LineageNode {
  /** "lesson" or "change" — the kind of node. */
  kind: "lesson" | "change";
  id: string;
}

/**
 * Walk the explicit provenance graph from a lesson: backward to its source
 * change, forward through every change that borrowed it, then onward to
 * lessons born from those changes (BFS, cycle-safe via visited sets). Honest:
 * only recorded (explicit) links — never heuristic inference.
 */
export function lineageOf(lessonId: string): LineageNode[] {
  if (!lessonExists(lessonId)) return [{ kind: "lesson", id: lessonId }];
  const visitedLessons = new Set<string>();
  const visitedChanges = new Set<string>();
  const nodes: LineageNode[] = [{ kind: "lesson", id: lessonId }];
  const queue: string[] = [lessonId];

  const bornFrom = lessonSourceChange(lessonId);
  if (bornFrom && !visitedChanges.has(bornFrom)) {
    visitedChanges.add(bornFrom);
    nodes.push({ kind: "change", id: bornFrom });
  }

  visitedLessons.add(lessonId);
  while (queue.length) {
    const curId = queue.shift()!;
    // Every change that explicitly borrowed this lesson.
    for (const changeId of appliedTo(curId)) {
      if (visitedChanges.has(changeId)) continue;
      visitedChanges.add(changeId);
      nodes.push({ kind: "change", id: changeId });
      // Lessons born from that change continue the chain forward.
      for (const nextLesson of lessonsBornFrom(changeId)) {
        if (visitedLessons.has(nextLesson)) continue;
        visitedLessons.add(nextLesson);
        nodes.push({ kind: "lesson", id: nextLesson });
        queue.push(nextLesson);
      }
    }
  }
  return nodes;
}
