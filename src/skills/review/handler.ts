import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../forge/handler.js";

/**
 * Review a change between forge and shield (v0.27): a deterministic,
 * zero-LLM checklist that catches the classic slips — missing proposal,
 * tasks whose snippets/tests do not exist, done tasks without test files,
 * and spec headings that do not match any exported symbol (the drift gate).
 */

export interface ReviewCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ReviewReport {
  changeId: string;
  checks: ReviewCheck[];
  pass: boolean;
}

const SYMBOL = /^export (?:const|function|class)\s+([A-Za-z0-9_$]+)/m;

/** Symbols exported from src/tasks/*.ts — what the drift gate matches. */
export function taskSymbols(): string[] {
  const dir = join(process.cwd(), "src", "tasks");
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const code = readFileSync(join(dir, f), "utf8");
    for (const m of code.matchAll(SYMBOL)) out.push(m[1]);
  }
  return out;
}

export function reviewChange(changeId: string): ReviewReport {
  const base = join("changes", changeId);
  const checks: ReviewCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });

  const proposal = (() => {
    const f = join(base, "proposal.json");
    if (!existsSync(f)) return null;
    try {
      return JSON.parse(readFileSync(f, "utf8")) as { title?: string };
    } catch {
      return null;
    }
  })();
  add(
    "proposal",
    !!proposal,
    proposal ? "proposal.json present" : "proposal.json missing",
  );

  const has = (rel: string) => existsSync(join(base, rel));
  add(
    "artifacts",
    has("tasks.md") && has("design.md"),
    [
      !has("tasks.md") && "tasks.md missing",
      !has("design.md") && "design.md missing",
    ]
      .filter(Boolean)
      .join(", ") || "tasks.md + design.md present",
  );

  const tasks = (() => {
    try {
      return readTasks(changeId);
    } catch {
      return [];
    }
  })();
  add(
    "tasks-parse",
    tasks.length > 0 || !has("tasks.md"),
    `${tasks.length} task(s) parsed`,
  );

  const snippets = existsSync(join(base, "snippets"))
    ? readdirSync(join(base, "snippets")).filter((f) => f.endsWith(".ts"))
    : [];
  add(
    "snippets",
    snippets.length >= tasks.length,
    `${snippets.length} snippet(s) for ${tasks.length} task(s)`,
  );

  const doneTasks = tasks.filter((t) => t.done);
  const missingTests = doneTasks
    .map((t) => {
      const slug = t.text.replace(/^\[(?:fact|assumption|risk)\]\s*/, "");
      const id = slug
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      return { id, slug };
    })
    .filter(({ id }) => id && !existsSync(join("tests", `${id}.test.ts`)))
    .map(({ id }) => id);
  add(
    "tests",
    missingTests.length === 0,
    missingTests.length
      ? `no test file for: ${missingTests.join(", ")}`
      : `${doneTasks.length} done task(s) have test files`,
  );

  const symbols = taskSymbols();
  const missingSym = doneTasks
    .map((t) => t.text.replace(/^\[(?:fact|assumption|risk)\]\s*/, ""))
    .filter((slug) => slug && !symbols.includes(slug))
    .slice(0, 5);
  add(
    "drift",
    missingSym.length === 0,
    missingSym.length
      ? `no exported symbol for: ${missingSym.join(", ")}`
      : "task slugs match exported symbols in src/tasks/*",
  );

  return {
    changeId,
    checks,
    pass: checks.every((c) => c.ok),
  };
}
