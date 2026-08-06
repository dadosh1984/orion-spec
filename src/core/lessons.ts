import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Orion self-correction & learning (v0.12).
 *
 * When any step of the workflow (think → draft → forge → shield → out)
 * fails or doubts itself, Orion records a Lesson instead of hiding it.
 * `next` then routes back to `think` with a corrected task derived from
 * the last lesson, and `think` attaches matching past lessons to new
 * proposals — so the same mistake is not repeated, across projects.
 *
 * Honesty rules:
 * - deterministic store, zero dependencies, fail-safe: a broken lesson
 *   must never crash the caller;
 * - identical errors are recorded once per (changeId, step, error) —
 *   repeating the same failure does not spam the ledger;
 * - capped at 500 entries, oldest evicted first.
 */

/** A single recorded self-correction lesson. */
export interface Lesson {
  id: string;
  ts: string;
  changeId: string;
  /** Workflow step that failed: shield | out | forge | tdd | draft. */
  step: string;
  error: string;
  cause?: string;
  fix?: string;
}

/** Payload accepted by `recordLesson` (id and ts are stamped). */
export type NewLesson = Omit<Lesson, "id" | "ts">;

const MAX_LESSONS = 500;

/** Ledger path (~/.orion/lessons.json; tests override via ORION_LESSONS_FILE). */
export function lessonsPath(): string {
  return (
    process.env.ORION_LESSONS_FILE ?? join(homedir(), ".orion", "lessons.json")
  );
}

/** Read all lessons; empty on missing/corrupt file (fail-safe). */
export function readLessons(): Lesson[] {
  try {
    const path = lessonsPath();
    if (!existsSync(path)) return [];
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(raw) ? (raw as Lesson[]) : [];
  } catch {
    return [];
  }
}

/**
 * Record a lesson. The same (changeId, step, error) is stored only once —
 * learning one mistake is enough. Never throws.
 */
export function recordLesson(lesson: NewLesson): Lesson {
  try {
    const entry: Lesson = {
      ...lesson,
      id: createHash("sha1")
        .update(
          `${lesson.changeId}:${lesson.step}:${lesson.error}:${Date.now()}`,
        )
        .digest("hex")
        .slice(0, 12),
      ts: new Date().toISOString(),
    };
    const rows = readLessons();
    const duplicate = rows.some(
      (r) =>
        r.changeId === entry.changeId &&
        r.step === entry.step &&
        r.error === entry.error,
    );
    if (!duplicate) {
      rows.push(entry);
      if (rows.length > MAX_LESSONS) rows.splice(0, rows.length - MAX_LESSONS);
      writeFileSync(lessonsPath(), JSON.stringify(rows), "utf8");
    }
    return entry;
  } catch {
    // fail-safe: the caller must never break because a lesson could not be saved
    return { ...lesson, id: "n/a", ts: new Date().toISOString() };
  }
}

/** Lessons for one change, or all lessons; newest first. */
export function listLessons(changeId?: string): Lesson[] {
  const rows = changeId
    ? readLessons().filter((l) => l.changeId === changeId)
    : readLessons();
  return [...rows].reverse();
}

/**
 * Find lessons relevant to a free-form text (goal, corrective prompt, …).
 * Word-based (signature words of length >= 4): a lesson matches when any of
 * its fields mentions any signature word. Returns up to 5, newest first.
 */
export function findLessons(text: string): Lesson[] {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9а-яё]+/i)
        .filter((w) => w.length >= 4),
    ),
  ];
  if (words.length === 0) return [];
  return readLessons()
    .filter((l) => {
      const hay = [l.changeId, l.step, l.error, l.cause, l.fix]
        .join(" ")
        .toLowerCase();
      return words.some((w) => hay.includes(w));
    })
    .slice(-5)
    .reverse();
}

/**
 * Lessons for an `out` summary (v0.14): the change's own recorded lessons,
 * recent first, plus up to 3 shared lessons matched against the change goal
 * via `findLessons` — deduplicated by id so a lesson never appears twice.
 */
export function lessonsForChange(changeId: string, goal: string): Lesson[] {
  const own = new Map<string, Lesson>();
  for (const l of listLessons(changeId)) own.set(l.id, l);
  for (const l of findLessons(`${changeId} ${goal}`)) {
    if (own.has(l.id) || l.changeId === changeId) continue;
    own.set(l.id, l); // once included, never again
  }
  return [...own.values()];
}

/** Aggregate stats for dashboards (`orion track status`). */
export function lessonsStats(): { count: number; lastTs: string | null } {
  const rows = readLessons();
  return {
    count: rows.length,
    lastTs: rows.length > 0 ? rows[rows.length - 1].ts : null,
  };
}
