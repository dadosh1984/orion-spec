import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { notifyLesson } from "../tasks/lesson_notify_visible.js";

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
  /** "error" (default) or "success" — a positive pattern (v0.29). */
  kind?: "error" | "success";
  /** "what worked" for success lessons; omitted for errors. */
  pattern?: string;
  /** Relevance score; bumped when a lesson prevents a recurrence (v0.29). */
  score?: number;
  /** Change this lesson was born from (v0.56 lineage); null/absent = manual. */
  sourceChange?: string;
}

/** Payload accepted by `recordLesson` (id and ts are stamped). */
export type NewLesson = Omit<Lesson, "id" | "ts">;

const MAX_LESSONS = 500;

/** Signature used for dedupe: one lesson per (changeId, step, error). */
function signature(l: Pick<Lesson, "changeId" | "step" | "error">): string {
  return `${l.changeId}:${l.step}:${l.error}`;
}

/** Ledger path (~/.orion/lessons.json; tests override via ORION_LESSONS_FILE). */
export function lessonsPath(): string {
  return (
    process.env.ORION_LESSONS_FILE ?? join(homedir(), ".orion", "lessons.json")
  );
}

/** Rows that look like a real lesson (defensive shape check, v0.20). */
function isLessonRow(row: unknown): row is Lesson {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return ["id", "ts", "changeId", "step", "error"].every(
    (k) => typeof r[k] === "string",
  );
}

/** Read all lessons; empty on missing/corrupt file (fail-safe). */
export function readLessons(): Lesson[] {
  try {
    const path = lessonsPath();
    if (!existsSync(path)) return [];
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(raw)) return [];
    // A well-formed array can still contain malformed rows — skip them
    // instead of passing garbage into findLessons/recordLesson.
    return raw.filter(isLessonRow);
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
      if (rows.length > MAX_LESSONS) {
        // Sort by score descending before eviction — keep high-value lessons.
        // ponytail: rung3 score-trim (lessons v0.57).
        rows.sort((a, b) => ((b.score ?? 0) - (a.score ?? 0)));
        rows.splice(MAX_LESSONS);
      }
      writeFileSync(lessonsPath(), JSON.stringify(rows), "utf8");
      // Visible self-correction (v0.26): the terminal shows that a lesson
      // was recorded (stderr — protocol-safe for CLI and MCP).
      notifyLesson(entry.step, entry.error);
    }
    return entry;
  } catch {
    // fail-safe: the caller must never break because a lesson could not be saved
    return { ...lesson, id: "n/a", ts: new Date().toISOString() };
  }
}

/** Record a positive learning pattern (v0.29, T5.6): what worked, so a
 * good outcome is reinforced as loudly as a failure would be. Kind = success;
 * dedupe keyed on (changeId, step, pattern). */
export function recordPattern(
  lesson: Omit<NewLesson, "error"> & { pattern: string },
): Lesson | null {
  const entry: Omit<Lesson, "id" | "ts"> = {
    changeId: lesson.changeId,
    step: lesson.step,
    error: `pattern: ${lesson.pattern}`,
    kind: "success",
    pattern: lesson.pattern,
    score: 0,
    sourceChange: lesson.sourceChange,
  };
  const rows = readLessons();
  const duplicate = rows.some(
    (r) =>
      r.changeId === entry.changeId &&
      r.step === entry.step &&
      r.error === entry.error,
  );
  if (duplicate) return null;
  return recordLesson(entry as NewLesson);
}

/** Bump a lesson's relevance score (v0.29): positive deltas mark a lesson
 * that prevented a recurrence. Returns the new score, or null if missing. */
export function rateLesson(id: string, delta = 1): number | null {
  try {
    const rows = readLessons();
    const l = rows.find((r) => r.id === id);
    if (!l) return null;
    l.score = (l.score ?? 0) + delta;
    writeFileSync(lessonsPath(), JSON.stringify(rows), "utf8");
    return l.score;
  } catch {
    return null;
  }
}

/** Lessons ranked by relevance: successes first, then by score, newest on
 * ties. What `track lessons` and `next` route on (v0.29). */
export function rankedLessons(): Lesson[] {
  return [...readLessons()].sort((a, b) => {
    const ka = a.kind === "success" ? 1 : 0;
    const kb = b.kind === "success" ? 1 : 0;
    if (ka !== kb) return kb - ka;
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    if (sa !== sb) return sb - sa;
    return (b.ts ?? "").localeCompare(a.ts ?? "");
  });
}

/** Lessons for one change, or all lessons; newest first. */
export function listLessons(changeId?: string): Lesson[] {
  const rows = changeId
    ? readLessons().filter((l) => l.changeId === changeId)
    : readLessons();
  return [...rows].reverse();
}

/**
 * Export the whole lesson ledger to a JSON file (v0.23, federated
 * learning — idea #20). Zero dependencies: a plain JSON array of lessons.
 */
export function exportLessons(path: string): { exported: number } {
  const rows = readLessons();
  writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  return { exported: rows.length };
}

/**
 * Merge lessons from a JSON file or URL (v0.23, federated learning).
 * Rows are validated and deduped by (changeId, step, error); the report is
 * honest: added / skipped / total, never a fabricated "all imported".
 * Network sources use the built-in fetch (Node 22+) — zero dependencies.
 */
export async function importLessons(source: string): Promise<{
  added: number;
  skipped: number;
  total: number;
}> {
  let text: string;
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`fetch ${source} failed: HTTP ${res.status}`);
    text = await res.text();
  } else {
    text = readFileSync(source, "utf8");
  }
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed))
    throw new Error(`import source ${source} is not a lessons array`);

  const existing = readLessons();
  const seen = new Set(existing.map(signature));
  let added = 0;
  let skipped = 0;
  for (const row of parsed) {
    if (!isLessonRow(row)) {
      skipped++;
      continue;
    }
    if (seen.has(signature(row))) {
      skipped++;
      continue;
    }
    existing.push({
      ...row,
      id: row.id || genLessonId(row),
      ts: row.ts || new Date().toISOString(),
    });
    seen.add(signature(row));
    added++;
  }
  if (added > 0) {
    if (existing.length > MAX_LESSONS) {
      // ponytail: rung3 score-trim (lessons v0.57) — same sort as recordLesson.
      existing.sort((a, b) => ((b.score ?? 0) - (a.score ?? 0)));
      existing.splice(MAX_LESSONS);
    }
    writeFileSync(lessonsPath(), JSON.stringify(existing), "utf8");
  }
  return { added, skipped, total: parsed.length };
}

/** Deterministic id for imported rows that lack one. */
function genLessonId(l: Pick<Lesson, "changeId" | "step" | "error">): string {
  return createHash("sha1")
    .update(`${l.changeId}:${l.step}:${l.error}`)
    .digest("hex")
    .slice(0, 12);
}

/**
 * Find lessons relevant to a free-form text (goal, corrective prompt, …).
 *
 * Two signals are blended, both zero-dependency:
 * 1. Word-based (signature words of length >= 4): a lesson matches when any
 *    of its fields mentions any signature word (substring containment).
 * 2. Character-trigram Jaccard (v0.22): catches partial overlaps that share
 *    no 4+ letter word — e.g. "unexpected end of input" vs "unexpected end
 *    of file", or a typo'd term — without a vector DB.
 *
 * Ranked by relevance — distinct signature words first, then n-gram
 * similarity, newest first as the final tie-break — instead of the old
 * newest-only selection. Returns up to 5. The ledger is capped at 500
 * entries, so a full statistical ranker (BM25/TF-IDF) would add complexity
 * without a measurable win; word match density plus n-gram similarity is
 * the honest, cheap signal.
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
  const queryGrams = trigrams(text);
  return readLessons()
    .map((l) => {
      const hay = [l.changeId, l.step, l.error, l.cause, l.fix]
        .join(" ")
        .toLowerCase();
      const matched = words.filter((w) => hay.includes(w)).length;
      const { sim, shared } = ngramSim(queryGrams, trigrams(hay));
      return matched > 0 ||
        (shared >= NGRAM_MIN_SHARED && sim >= NGRAM_THRESHOLD)
        ? { lesson: l, matched, sim }
        : null;
    })
    .filter(
      (x): x is { lesson: Lesson; matched: number; sim: number } => x !== null,
    )
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        b.sim - a.sim ||
        (a.lesson.ts < b.lesson.ts ? 1 : a.lesson.ts > b.lesson.ts ? -1 : 0),
    )
    .slice(0, 5)
    .map((x) => x.lesson);
}

/** Character trigram set (lowercased) — the n-gram similarity input. */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = s.toLowerCase();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

/**
 * N-gram similarity: shared trigrams over the smaller set (containment,
 * not symmetric Jaccard — the query is short and the lesson hay is long, so
 * containment is the honest signal). Returns the ratio plus the absolute
 * shared count so short strings need a floor, not just a ratio.
 */
function ngramSim(
  a: Set<string>,
  b: Set<string>,
): { sim: number; shared: number } {
  if (a.size === 0 || b.size === 0) return { sim: 0, shared: 0 };
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return { sim: shared / Math.min(a.size, b.size), shared };
}

/** A fuzzy candidate needs at least this many shared trigrams… */
const NGRAM_MIN_SHARED = 3;

/** …and this ratio of the smaller set to count as similar. */
const NGRAM_THRESHOLD = 0.25;

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
