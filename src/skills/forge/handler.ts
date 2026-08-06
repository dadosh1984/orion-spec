import { readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { TddEngine } from "../../core/tddCore.js";
import { OrionTrack } from "../../core/track.js";
import { slugify } from "../think/handler.js";

/** Result of the forge loop over all open tasks. */
export interface ForgeSummary {
  ok: boolean;
  done: number;
  total: number;
  skipped: number;
  pending: string[];
  message: string;
}

/** Factory that creates the TDD engine used per task (injectable in tests). */
export type EngineFactory = (slug: string, track: OrionTrack) => TddEngine;

/** Default engine factory: real TddEngine bound to the default config. */
export const defaultEngineFactory: EngineFactory = (slug, track) =>
  new TddEngine(slug, track);

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
  opts?: { noCache?: boolean },
  snippetProvider: (slug: string) => Promise<string | null> = async (slug) => {
    const file = `changes/${title}/snippets/${slug}.ts`;
    if (!existsSync(file)) return null;
    return readFile(file, "utf8");
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

  const tasksMd = await readFile(tasksPath, "utf8");
  const open = tasksMd
    .split("\n")
    .map((l) => l.match(/^- \[ \]\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1]);

  const pending: string[] = [];
  let done = 0;
  let skipped = 0;

  for (const desc of open) {
    // identifier-safe slug: dashes are illegal in JS identifiers and would
    // break `import { <slug> } from ...` in the generated test template.
    const slug = slugify(desc).replace(/-/g, "_");
    if (!opts?.noCache && track.loadString(`forge:${slug}`) === "DONE") {
      skipped++;
      markTaskDone(tasksPath, desc);
      continue;
    }

    const engine = engineFactory(slug, track);
    await engine.generateTest();

    const snippet = await snippetProvider(slug);
    if (snippet === null) {
      pending.push(slug);
      continue;
    }

    await engine.applyCode(snippet);
    const passed = await engine.runTest();
    engine.transition(passed);
    if (!passed) {
      pending.push(slug);
      continue;
    }

    await engine.refactor();
    engine.finalize();
    if (!opts?.noCache) {
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
    markTaskDone(tasksPath, desc);
    done++;
  }

  return {
    ok: pending.length === 0,
    done,
    total: open.length,
    skipped,
    pending,
    message:
      pending.length === 0
        ? `forge complete: ${done} done, ${skipped} skipped from cache`
        : `forge paused: ${done} done, ${skipped} skipped, ${pending.length} pending (${pending.join(", ")})`,
  };
}

/** Flip a `- [ ]` checklist line to `- [x]` in tasks.md. */
function markTaskDone(tasksPath: string, desc: string): void {
  const updated = readFileSync(tasksPath, "utf8").replace(
    `- [ ] ${desc}`,
    `- [x] ${desc}`,
  );
  writeFileSync(tasksPath, updated, "utf8");
}
