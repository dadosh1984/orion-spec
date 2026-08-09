import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { fork } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { TddEngine } from "../../core/tddCore.js";
import { OrionTrack } from "../../core/track.js";
import { recordLesson } from "../../core/lessons.js";
import { writeFileSafe } from "../../utils/file.js";
import { writeCheckpoint } from "../../core/checkpoint.js";
import { slugify } from "../think/handler.js";
import { significantWords } from "../../core/titles.js";
import { resolveSnippet } from "./snippet.js";

const execAsync = promisify(exec);

/** Result of the forge loop over all open tasks. */
export interface ForgeSummary {
  ok: boolean;
  done: number;
  total: number;
  skipped: number;
  pending: string[];
  /** Exact paths forge is waiting on (implementation snippets). */
  missingSnippets: string[];
  message: string;
  /** Where the forge report was written (changes/<title>/forge-report.md). */
  reportPath: string;
}

/** Factory that creates the TDD engine used per task (injectable in tests). */
export type EngineFactory = (slug: string, track: OrionTrack) => TddEngine;

/** Default engine factory: real TddEngine bound to the default config. */
export const defaultEngineFactory: EngineFactory = (slug, track) =>
  new TddEngine(slug, track);

/** Live progress callback fired once per task decision. */
export interface ForgeOptions {
  noCache?: boolean;
  /** Called as each task is resolved (done/skipped/pending) — CLI progress. */
  onTask?: (row: {
    desc: string;
    status: "done" | "skipped" | "pending";
  }) => void;
  /** MCP progress (v0.22): (done, total, message) as tasks resolve. */
  onProgress?: (done: number, total: number, message: string) => void;
}

/** One task entry parsed from tasks.md. */
export interface TaskItem {
  text: string;
  done: boolean;
}

/** Parse the task checklist from `changes/<title>/tasks.md`. */
export function readTasks(title: string): TaskItem[] {
  const path = `changes/${title}/tasks.md`;
  if (!existsSync(path)) return [];
  return (
    readFileSync(path, "utf8")
      .split("\n")
      // CRLF-safe: `$` without the m flag won't match before `\r`, and `.`
      // never matches it — so strip the CR so Windows checklists parse.
      .map((l) => l.replace(/\r$/, ""))
      .map((l) => l.match(/^- \[( |x)\]\s+(.+)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => ({ done: m[1] === "x", text: m[2] }))
  );
}

/** One task's RED-GREEN outcome as seen by the wave engine. */
export interface TaskOutcome {
  slug: string;
  desc: string;
  ok: boolean;
  /** Honest reason when the task could not be completed. */
  lastFailure?: string;
  /** Why it's pending: "no-snippet", "red" (test failed), or "timeout". */
  reason: "no-snippet" | "red" | "timeout";
}

/** Snapshot of a file's pre-forge state — the rollback target. */
interface FileSnapshot {
  existed: boolean;
  content: string;
}

/** Read a file for the rollback snapshot; missing → `{ existed: false }`. */
function snapshotFile(path: string): FileSnapshot {
  try {
    return { existed: true, content: readFileSync(path, "utf8") };
  } catch {
    return { existed: false, content: "" };
  }
}

/**
 * Restore a file to its pre-forge state: files that existed before forge
 * (user work) are rewritten with their original content; files forge
 * created are removed. Best effort — never masks the underlying outcome.
 */
function restoreFile(path: string, snap: FileSnapshot): void {
  try {
    if (snap.existed) writeFileSync(path, snap.content, "utf8");
    else rmSync(path, { force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Run one task's RED-GREEN cycle without touching shared files
 * (tasks.md, lessons.json, forge cache). Generates the test, applies the
 * snippet, runs the tests, transitions the state machine. The caller
 * (sequential forge, the wave engine's parent, or the fork worker)
 * applies bookkeeping — this is the single source of truth for the cycle.
 *
 * No-junk contract (v0.25): the snippet is checked BEFORE anything is
 * written, and files forge created are rolled back on a RED/hazard
 * outcome. The old order generated `tests/<slug>.test.ts` first, so a
 * task waiting for its snippet left an orphaned test importing a
 * `src/tasks/<slug>.ts` that never existed — breaking the project's
 * vitest run and producing FALSE shield FAILs (`test: N failing`, `drift:
 * missing exported`). Unfinished tasks now leave zero trace; files that
 * existed before forge (user work) are restored, never deleted.
 */
export async function executeTask(
  title: string,
  slug: string,
  desc: string,
  snippetProvider: (slug: string) => Promise<string | null>,
  engineFactory: EngineFactory,
  track: OrionTrack,
): Promise<TaskOutcome> {
  const engine = engineFactory(slug, track);

  // Snippet first: a missing snippet must create nothing at all.
  const snippet = await snippetProvider(slug);
  if (snippet === null) {
    return {
      slug,
      desc,
      ok: false,
      reason: "no-snippet",
      lastFailure: `missing implementation snippet for ${slug}`,
    };
  }

  // Snapshot the two files forge is about to touch so a RED/hazard
  // outcome can restore them exactly.
  const testPath = join(
    engine.config.testDir,
    `${slug}${engine.config.testExt}`,
  );
  const srcPath = join(engine.config.srcDir, `${slug}${engine.config.srcExt}`);
  const testSnap = snapshotFile(testPath);
  const srcSnap = snapshotFile(srcPath);

  let passed: boolean;
  try {
    await engine.generateTest();
    await engine.applyCode(snippet);
    passed = await engine.runTest();
  } catch (err) {
    // Hazard gate or any engine error — refuse to leave half-written files.
    restoreFile(testPath, testSnap);
    restoreFile(srcPath, srcSnap);
    return {
      slug,
      desc,
      ok: false,
      reason: "red",
      lastFailure: err instanceof Error ? err.message : String(err),
    };
  }
  engine.transition(passed);
  if (!passed) {
    restoreFile(testPath, testSnap);
    restoreFile(srcPath, srcSnap);
    return {
      slug,
      desc,
      ok: false,
      reason: "red",
      lastFailure: engine.lastFailure ?? "no details",
    };
  }
  await engine.refactor();
  engine.finalize();
  return { slug, desc, ok: true, reason: "red" };
}

/**
 * Parent-side bookkeeping for one task outcome — applied sequentially, so
 * shared files (tasks.md, lessons.json) always have exactly one writer.
 * Used by both the sequential forge and the wave engine after each wave.
 */
async function finishTask(
  title: string,
  outcome: TaskOutcome,
  track: OrionTrack,
  opts: { noCache?: boolean },
): Promise<void> {
  const { slug, desc } = outcome;
  if (outcome.ok) {
    if (!opts.noCache) {
      track.store(`forge:${slug}`, "DONE");
      // guard checks must be recomputed after a code change
      track.invalidate([
        "shield:lint",
        "shield:type",
        "shield:test",
        "shield:drift",
        "shield:security",
      ]);
    }
    markTaskDone(`changes/${title}/tasks.md`, desc);
    return;
  }
  if (outcome.reason === "red") {
    // Self-correction (v0.12): a task that could not be completed is a
    // lesson — `next` will route back to `think` with a corrective task.
    recordLesson({
      changeId: title,
      step: "forge",
      error:
        `task not green: ${desc} — ${outcome.lastFailure ?? "no details"}`.slice(
          0,
          240,
        ),
      cause: "forge RED state (test failing or snippet missing)",
      fix: `fix the task, then re-run orion forge ${title}`,
    });
  }
}

/** Marker prefix on task lines that is not part of the task's name. */
const SLUG_MARKER = /^\[(fact|assumption|risk|decision)\]\s*/i;

/**
 * Explicit per-task slug marker: `- [ ] [fact] Implement add {slug: my_unit}`
 * (v0.25). Lets the plan author pin the file name instead of guessing
 * which 2–3 significant words `shortSlug` will pick.
 */
const EXPLICIT_SLUG = /\{\s*slug\s*:\s*([a-z0-9_-]+)\s*\}/i;

/**
 * Short, identifier-safe task slug (2–3 significant words, v0.24).
 *
 * The old slug kept EVERY word of the task description (up to 64 chars,
 * marker included) — `[assumption] Add arithmetic operations: add,
 * subtract, multiply, divide` became a 55-char file name. Now the marker
 * is stripped and only 2–3 significant words survive, so snippet files are
 * as short as change titles ("add_arithmetic_operations",
 * "implement_calculator"). Underscores (not dashes): the slug is used as a
 * JS identifier in the generated test template (`import { <slug> } …`).
 * Uniqueness within a change is enforced deterministically: a collision
 * appends `_2`, `_3`, … in tasks.md order. Cyrillic is kept — the same
 * promise as change titles. Falls back to `slugify` when nothing
 * significant survives.
 *
 * v0.25: an explicit `{slug: name}` marker in the description wins over
 * the word derivation — predictable file names, no guessing.
 */
export function shortSlug(desc: string, used: Set<string>): string {
  const cleaned = desc.replace(SLUG_MARKER, "");
  const explicit = cleaned.match(EXPLICIT_SLUG)?.[1]?.toLowerCase();
  const base =
    explicit ??
    (() => {
      const words = significantWords(cleaned, 3);
      return words.length > 0
        ? words.join("_")
        : slugify(cleaned).replace(/-/g, "_");
    })();
  const fallback = base || "untitled";
  let slug = fallback;
  let n = 2;
  while (used.has(slug)) slug = `${fallback}_${n++}`;
  used.add(slug);
  return slug;
}

/**
 * `orion forge` — walk `changes/<title>/tasks.md` and drive each open
 * `- [ ]` task through the RED-GREEN-REFACTOR engine.
 *
 * The implementation snippet for a task is read from
 * `changes/<title>/snippets/<slug>.ts` (or provided by an injected
 * provider, which also makes the loop testable).
 */
export async function forge(
  title: string,
  opts?: ForgeOptions,
  snippetProvider: (slug: string) => Promise<string | null> = async (slug) => {
    const r = resolveSnippet(`changes/${title}/snippets`, slug);
    return r.content;
  },
  engineFactory: EngineFactory = defaultEngineFactory,
): Promise<ForgeSummary> {
  const track = OrionTrack.init();
  const tasksPath = `changes/${title}/tasks.md`;
  if (!existsSync(tasksPath)) {
    throw new Error(
      `no tasks.md found under changes/${title}/ — run "orion draft ${title}" first`,
    );
  }

  const open = readTasks(title)
    .filter((t) => !t.done)
    .map((t) => t.text);

  const pending: string[] = [];
  const missingSnippets: string[] = [];
  /** Diagnostics for unresolved snippets: expected slug + existing files. */
  const snippetHints: string[] = [];
  const rows: Array<{ desc: string; status: "done" | "skipped" | "pending" }> =
    [];
  let done = 0;
  let skipped = 0;
  // Slugs must be unique within a change (v0.24): two tasks whose first
  // 2–3 significant words collide get `_2`, `_3`, … deterministically.
  const usedSlugs = new Set<string>();

  for (const desc of open) {
    // identifier-safe slug: dashes are illegal in JS identifiers and would
    // break `import { <slug> } from ...` in the generated test template.
    const slug = shortSlug(desc, usedSlugs);
    if (!opts?.noCache && track.loadString(`forge:${slug}`) === "DONE") {
      skipped++;
      rows.push({ desc, status: "skipped" });
      opts?.onTask?.({ desc, status: "skipped" });
      opts?.onProgress?.(done + skipped, open.length, `skipped ${desc}`);
      markTaskDone(tasksPath, desc);
      continue;
    }

    const outcome = await executeTask(
      title,
      slug,
      desc,
      snippetProvider,
      engineFactory,
      track,
    );
    await finishTask(title, outcome, track, { noCache: opts?.noCache });
    opts?.onProgress?.(done + skipped + 1, open.length, desc);

    if (!outcome.ok) {
      pending.push(slug);
      missingSnippets.push(`changes/${title}/snippets/${slug}.ts`);
      const r = resolveSnippet(`changes/${title}/snippets`, slug);
      if (
        r.content === null &&
        r.candidates &&
        r.candidates.length > 0 &&
        snippetHints.length < 3
      ) {
        snippetHints.push(
          `${slug}: no exact match — existing: ${r.candidates.join(", ")}`,
        );
      }
      rows.push({ desc, status: "pending" });
      opts?.onTask?.({ desc, status: "pending" });
      continue;
    }

    rows.push({ desc, status: "done" });
    opts?.onTask?.({ desc, status: "done" });
    done++;
  }

  const summary: ForgeSummary = {
    ok: pending.length === 0,
    done,
    total: open.length,
    skipped,
    pending,
    missingSnippets,
    reportPath: `changes/${title}/forge-report.md`,
    message:
      pending.length === 0
        ? `forge complete: ${done} done, ${skipped} skipped from cache`
        : `forge paused: ${done} done, ${skipped} skipped, ${pending.length} pending — add snippets: ${missingSnippets.join(", ")}` +
          (snippetHints.length > 0 ? `\n${snippetHints.join("\n")}` : ""),
  };

  await writeForgeReport(title, summary, rows);
  return summary;
}

/** Worker reply over IPC (v0.16). */
export interface WaveWorkerReply {
  slug: string;
  status: "done" | "pending";
  lastFailure?: string;
  reason?: "no-snippet" | "red" | "timeout";
}

/**
 * Runs one wave of tasks. Injected by tests; the default implementation
 * forks one worker per task (see `forkRunner`).
 */
export type WaveRunner = (
  title: string,
  slugs: string[],
  opts: { noCache?: boolean },
) => Promise<WaveWorkerReply[]>;

/**
 * `forge --parallel` (v0.16): drive open tasks in sequential waves, with
 * each wave's tasks running in their own forked child process. Workers
 * only do RED-GREEN (test + snippet + run); every shared-file mutation
 * (tasks.md, lessons.json, forge cache) happens in this parent, applied
 * sequentially after each wave — shared files never have two writers.
 */
export async function forgeParallel(
  title: string,
  opts?: ForgeOptions & { parallel?: number; refactor?: () => Promise<void> },
  runner: WaveRunner = forkRunner,
): Promise<ForgeSummary> {
  const track = OrionTrack.init();
  const tasksPath = `changes/${title}/tasks.md`;
  if (!existsSync(tasksPath)) {
    throw new Error(
      `no tasks.md found under changes/${title}/ — run "orion draft ${title}" first`,
    );
  }
  const concurrency = Math.max(2, opts?.parallel ?? 2);
  const open = readTasks(title)
    .filter((t) => !t.done)
    .map((t) => t.text);

  const pending: string[] = [];
  const missingSnippets: string[] = [];
  const rows: Array<{ desc: string; status: "done" | "skipped" | "pending" }> =
    [];
  let done = 0;
  let skipped = 0;

  const bySlug = new Map<string, string>();
  // Same uniqueness contract as the sequential path (v0.24).
  const usedSlugs = new Set<string>();
  for (const desc of open) {
    const slug = shortSlug(desc, usedSlugs);
    bySlug.set(slug, desc);
    if (!opts?.noCache && track.loadString(`forge:${slug}`) === "DONE") {
      skipped++;
      rows.push({ desc, status: "skipped" });
      opts?.onTask?.({ desc, status: "skipped" });
      markTaskDone(tasksPath, desc);
    }
  }
  const toRun = [...bySlug.keys()].filter((slug) =>
    opts?.noCache ? true : track.loadString(`forge:${slug}`) !== "DONE",
  );

  const waves = chunks(toRun, concurrency);
  let waveIndex = 0;
  for (const wave of waves) {
    waveIndex++;
    const replies = await runner(title, wave, { noCache: opts?.noCache });
    const doneInWave: string[] = [];
    for (const reply of replies) {
      const desc = bySlug.get(reply.slug) ?? reply.slug;
      if (reply.status === "done") {
        await finishTask(
          title,
          {
            slug: reply.slug,
            desc,
            ok: true,
            reason: "red",
          },
          track,
          { noCache: opts?.noCache },
        );
        doneInWave.push(reply.slug);
        done++;
        rows.push({ desc, status: "done" });
        opts?.onTask?.({ desc, status: "done" });
      } else {
        await finishTask(
          title,
          {
            slug: reply.slug,
            desc,
            ok: false,
            reason: reply.reason ?? "red",
            lastFailure: reply.lastFailure,
          },
          track,
          { noCache: opts?.noCache },
        );
        pending.push(reply.slug);
        missingSnippets.push(`changes/${title}/snippets/${reply.slug}.ts`);
        rows.push({ desc, status: "pending" });
        opts?.onTask?.({ desc, status: "pending" });
      }
    }
    // refactor is a whole-src/tasks operation: run it once per wave, in
    // the parent, after every worker of the wave has exited.
    if (doneInWave.length > 0) {
      await (opts?.refactor ?? refactorAll)();
    }
    opts?.onProgress?.(
      done + skipped,
      open.length,
      `wave ${waveIndex}/${waves.length} complete`,
    );
    writeCheckpoint({
      changeId: title,
      phase: "forge",
      step: `wave ${waveIndex}/${waves.length}`,
    });
  }

  const summary: ForgeSummary = {
    ok: pending.length === 0,
    done,
    total: open.length,
    skipped,
    pending,
    missingSnippets,
    reportPath: `changes/${title}/forge-report.md`,
    message: `${pending.length === 0 ? "forge complete" : "forge paused"}: ${done} done, ${skipped} skipped, ${pending.length} pending across ${waveIndex} wave(s) of ${concurrency}`,
  };

  await writeForgeReport(title, summary, rows);
  return summary;
}

/** Split an array into sequential chunks of at most `size`. */
export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** eslint --fix + prettier over src/tasks — one whole-directory pass. */
export async function refactorAll(): Promise<void> {
  try {
    await execAsync("pnpm exec eslint src/tasks --fix", { cwd: process.cwd() });
    await execAsync('pnpm exec prettier --write "src/tasks/**/*.ts"', {
      cwd: process.cwd(),
    });
  } catch {
    /* best effort, like TddEngine.refactor() */
  }
}

/**
 * Default wave runner: fork one worker per task. Each worker runs the
 * RED-GREEN cycle and replies over IPC; a crashed worker or a worker that
 * exits without replying is reported honestly as pending (never a fake
 * "done"). The worker path is injectable for tests.
 */
export async function forkRunner(
  title: string,
  slugs: string[],
  opts: { noCache?: boolean },
  workerPath: string = fileURLToPath(new URL("./worker.js", import.meta.url)),
): Promise<WaveWorkerReply[]> {
  // A hung worker (no reply, no exit) must not block the wave forever.
  // Generous default — TDD cycles run real test suites — overridable via env.
  const timeoutMs =
    Number(process.env.ORION_FORGE_TASK_TIMEOUT_MS) || 10 * 60 * 1000;
  const results = await Promise.all(
    slugs.map(
      (slug) =>
        new Promise<WaveWorkerReply>((resolve) => {
          const child = fork(workerPath, [], {
            cwd: process.cwd(),
            stdio: "ignore",
          });
          let settled = false;
          const resolveOnce = (reply: WaveWorkerReply): void => {
            if (settled) return;
            settled = true;
            try {
              child.kill();
            } catch {
              /* already gone */
            }
            resolve(reply);
          };
          // All callbacks below run asynchronously (after `timer` is set),
          // so referencing `timer` inside them is never a TDZ issue.
          const timer = setTimeout(() => {
            resolveOnce({
              slug,
              status: "pending",
              reason: "timeout",
              lastFailure: `worker for ${slug} hung — killed after ${Math.round(timeoutMs / 1000)}s`,
            });
          }, timeoutMs);
          child.on("message", (m) => {
            clearTimeout(timer);
            resolveOnce(m as WaveWorkerReply);
          });
          child.on("error", () => {
            clearTimeout(timer);
            resolveOnce({
              slug,
              status: "pending",
              reason: "red",
              lastFailure: `worker crashed for ${slug}`,
            });
          });
          child.on("exit", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
              resolveOnce({
                slug,
                status: "pending",
                reason: "red",
                lastFailure: `worker exited with code ${code} for ${slug}`,
              });
            } else {
              // clean exit without a reply — an honest pending, not a hang
              resolveOnce({
                slug,
                status: "pending",
                reason: "red",
                lastFailure: `worker exited without replying for ${slug}`,
              });
            }
          });
          child.send({ title, slug, noCache: opts?.noCache });
        }),
    ),
  );
  return results;
}

/** Write the forge summary as markdown + JSON next to tasks.md. */
async function writeForgeReport(
  title: string,
  summary: ForgeSummary,
  rows: Array<{ desc: string; status: "done" | "skipped" | "pending" }>,
): Promise<void> {
  const md = [
    `# Forge Report — ${title}`,
    "",
    `- **Status:** ${summary.ok ? "complete" : "paused"}`,
    `- **Done:** ${summary.done} · **Skipped (cache):** ${summary.skipped} · **Pending:** ${summary.pending.length}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
    "| Task | Status |",
    "|------|--------|",
    ...rows.map((r) => `| ${r.desc} | ${r.status} |`),
    "",
    summary.missingSnippets.length > 0
      ? `Waiting for implementation snippets:\n${summary.missingSnippets.map((s) => `- \`${s}\``).join("\n")}`
      : "",
    "",
  ].join("\n");

  await writeFileSafe(`changes/${title}/forge-report.md`, md);
  await writeFileSafe(
    `changes/${title}/forge-report.json`,
    JSON.stringify(summary, null, 2),
  );
}

/** Flip a `- [ ]` checklist line to `- [x]` in tasks.md. */
function markTaskDone(tasksPath: string, desc: string): void {
  const updated = readFileSync(tasksPath, "utf8").replace(
    `- [ ] ${desc}`,
    `- [x] ${desc}`,
  );
  writeFileSync(tasksPath, updated, "utf8");
}
