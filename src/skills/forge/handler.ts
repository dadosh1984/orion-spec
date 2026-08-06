import { readFile } from "node:fs/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { TddEngine } from "../../core/tddCore.js";
import { OrionTrack } from "../../core/track.js";
import { writeFileSafe } from "../../utils/file.js";
import { slugify } from "../think/handler.js";

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
  const missingSnippets: string[] = [];
  const rows: Array<{ desc: string; status: "done" | "skipped" | "pending" }> =
    [];
  let done = 0;
  let skipped = 0;

  for (const desc of open) {
    // identifier-safe slug: dashes are illegal in JS identifiers and would
    // break `import { <slug> } from ...` in the generated test template.
    const slug = slugify(desc).replace(/-/g, "_");
    if (!opts?.noCache && track.loadString(`forge:${slug}`) === "DONE") {
      skipped++;
      rows.push({ desc, status: "skipped" });
      markTaskDone(tasksPath, desc);
      continue;
    }

    const engine = engineFactory(slug, track);
    await engine.generateTest();

    const snippet = await snippetProvider(slug);
    if (snippet === null) {
      pending.push(slug);
      missingSnippets.push(`changes/${title}/snippets/${slug}.ts`);
      rows.push({ desc, status: "pending" });
      continue;
    }

    await engine.applyCode(snippet);
    const passed = await engine.runTest();
    engine.transition(passed);
    if (!passed) {
      pending.push(slug);
      missingSnippets.push(`changes/${title}/snippets/${slug}.ts`);
      rows.push({ desc, status: "pending" });
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
    rows.push({ desc, status: "done" });
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
        : `forge paused: ${done} done, ${skipped} skipped, ${pending.length} pending — add snippets: ${missingSnippets.join(", ")}`,
  };

  await writeForgeReport(title, summary, rows);
  return summary;
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
