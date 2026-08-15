import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { notifyLesson } from "../tasks/lesson_notify_visible.js";
import { fileStore, type Store } from "./store.js";

/**
 * Orion self-correction & learning (v0.12).
 *
 * Honesty rules:
 * - deterministic store, zero dependencies, fail-safe: a broken lesson
 *   must never crash the caller;
 * - identical errors are recorded once per (changeId, step, error) —
 *   repeating the same failure does not spam the ledger;
 * - capped at 500 entries, evicting lowest-score first.
 */

export interface Lesson {
  id: string;
  ts: string;
  changeId: string;
  step: string;
  error: string;
  cause?: string;
  fix?: string;
  kind?: "error" | "success";
  pattern?: string;
  score?: number;
  sourceChange?: string;
}

export type NewLesson = Omit<Lesson, "id" | "ts">;

const MAX_LESSONS = 500;

function signature(l: Pick<Lesson, "changeId" | "step" | "error">): string {
  return `${l.changeId}:${l.step}:${l.error}`;
}

export function lessonsPath(): string {
  return (
    process.env.ORION_LESSONS_FILE ?? join(homedir(), ".orion", "lessons.json")
  );
}

/** Default sort: lowest score first (ascending), oldest on ties. */
function scoreSort(a: Lesson, b: Lesson): number {
  const sa = a.score ?? 0;
  const sb = b.score ?? 0;
  if (sa !== sb) return sa - sb;
  return (a.ts ?? "").localeCompare(b.ts ?? "");
}

// ---- Store abstraction ----

let _store: Store<Lesson> | null = null;
let _lastLessonsPath = "";

function getStore(): Store<Lesson> {
  const path = lessonsPath();
  if (!_store || _lastLessonsPath !== path) {
    _store = fileStore<Lesson>(path);
    _lastLessonsPath = path;
  }
  return _store;
}

/** Override store for tests (e.g. memoryStore). */
export function setLessonsStore(store: Store<Lesson>): void {
  _store = store;
  _lastLessonsPath = lessonsPath();
}

/** Reset to default fileStore. */
export function resetLessonsStore(): void {
  _store = null;
  _lastLessonsPath = "";
}

// ---- Read helpers ----

function isLessonRow(row: unknown): row is Lesson {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return ["id", "ts", "changeId", "step", "error"].every(
    (k) => typeof r[k] === "string",
  );
}

/** Raw load, filtered for shape validity. */
function loadFiltered(): Lesson[] {
  return getStore().load().filter(isLessonRow);
}

/** Read all lessons. */
export function readLessons(): Lesson[] {
  return loadFiltered();
}

// ---- Mutations ----

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
    const rows = loadFiltered();
    const duplicate = rows.some(
      (r) =>
        r.changeId === entry.changeId &&
        r.step === entry.step &&
        r.error === entry.error,
    );
    if (!duplicate) {
      // Append via store, then cap.
      getStore().append(entry);
      getStore().cap(MAX_LESSONS, scoreSort);
      notifyLesson(entry.step, entry.error);
    }
    return entry;
  } catch {
    return { ...lesson, id: "n/a", ts: new Date().toISOString() };
  }
}

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
  const rows = loadFiltered();
  const duplicate = rows.some(
    (r) =>
      r.changeId === entry.changeId &&
      r.step === entry.step &&
      r.error === entry.error,
  );
  if (duplicate) return null;
  return recordLesson(entry as NewLesson);
}

export function rateLesson(id: string, delta = 1): number | null {
  try {
    const rows = loadFiltered();
    const l = rows.find((r) => r.id === id);
    if (!l) return null;
    l.score = (l.score ?? 0) + delta;
    getStore().replace(rows);
    return l.score;
  } catch {
    return null;
  }
}

// ---- Read-only queries ----

export function rankedLessons(): Lesson[] {
  return [...loadFiltered()].sort((a, b) => {
    const ka = a.kind === "success" ? 1 : 0;
    const kb = b.kind === "success" ? 1 : 0;
    if (ka !== kb) return kb - ka;
    return scoreSort(a, b);
  });
}

export function listLessons(changeId?: string): Lesson[] {
  const rows = changeId
    ? loadFiltered().filter((l) => l.changeId === changeId)
    : loadFiltered();
  return [...rows].reverse();
}

export function exportLessons(path: string): { exported: number } {
  const rows = readLessons();
  writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  return { exported: rows.length };
}

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

  const existing = loadFiltered();
  const seen = new Set(existing.map(signature));
  let added = 0;
  let skipped = 0;
  for (const row of parsed) {
    if (!isLessonRow(row)) { skipped++; continue; }
    if (seen.has(signature(row))) { skipped++; continue; }
    existing.push({
      ...row,
      id: row.id || genLessonId(row),
      ts: row.ts || new Date().toISOString(),
    });
    seen.add(signature(row));
    added++;
  }
  if (added > 0) {
    existing.sort(scoreSort);
    if (existing.length > MAX_LESSONS) existing = existing.slice(0, MAX_LESSONS);
    getStore().replace(existing);
  }
  return { added, skipped, total: parsed.length };
}

function genLessonId(l: Pick<Lesson, "changeId" | "step" | "error">): string {
  return createHash("sha1")
    .update(`${l.changeId}:${l.step}:${l.error}`)
    .digest("hex")
    .slice(0, 12);
}

// ---- Search ----

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
  return loadFiltered()
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

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = s.toLowerCase();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

function ngramSim(
  a: Set<string>,
  b: Set<string>,
): { sim: number; shared: number } {
  if (a.size === 0 || b.size === 0) return { sim: 0, shared: 0 };
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return { sim: shared / Math.min(a.size, b.size), shared };
}

const NGRAM_MIN_SHARED = 3;
const NGRAM_THRESHOLD = 0.25;

export function lessonsForChange(changeId: string, goal: string): Lesson[] {
  const own = new Map<string, Lesson>();
  for (const l of listLessons(changeId)) own.set(l.id, l);
  for (const l of findLessons(`${changeId} ${goal}`)) {
    if (own.has(l.id) || l.changeId === changeId) continue;
    own.set(l.id, l);
  }
  return [...own.values()];
}

export function lessonsStats(): { count: number; lastTs: string | null } {
  const rows = loadFiltered();
  return {
    count: rows.length,
    lastTs: rows.length > 0 ? rows[rows.length - 1].ts : null,
  };
}
