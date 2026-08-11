import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared drift gate (v0.37) — extracted from serve.ts so both the dashboard
 * and review/handler.ts reuse the same deterministic logic. Memoized by
 * change directory mtime; a stat-only cache that invalidates on any edit.
 */

const SYMBOL =
  /^export (?:const|function|class)\s+([A-Za-z0-9_$]+)\s*(?:=|\()/gm;

const driftCache = new Map<
  string,
  { mtime: number; ok: boolean | null; symbols: string[] }
>();

/** Symbols exported from src/tasks/*.ts (cached by directory mtime). */
export function taskSymbols(): string[] {
  const dir = join(process.cwd(), "src", "tasks");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  let mtime = 0;
  for (const f of files) {
    try {
      mtime = Math.max(mtime, statSync(join(dir, f)).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  const cacheKey = `tasks:${mtime}`;
  const hit = driftCache.get(cacheKey);
  if (hit) return hit.symbols;

  const out: string[] = [];
  for (const f of files) {
    const code = readFileSync(join(dir, f), "utf8");
    for (const m of code.matchAll(SYMBOL)) out.push(m[1]);
  }
  driftCache.set(cacheKey, { mtime, ok: null, symbols: out });
  return out;
}

/**
 * Drift check for one change: do spec headings match exported symbols?
 * Returns null when no specs exist, true when all match, false on mismatch.
 * Memoized by the change directory's newest mtime.
 */
export function driftOf(changeId: string): boolean | null {
  const base = join("changes", changeId, "specs");
  if (!existsSync(base)) return null;

  let mtime = 0;
  const walk = (dir: string): void => {
    let ents: string[] = [];
    try {
      ents = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of ents) {
      if (e === ".orion-cache") continue;
      const p = join(dir, e);
      try {
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else mtime = Math.max(mtime, st.mtimeMs);
      } catch {
        /* ignore */
      }
    }
  };
  walk(base);

  const hit = driftCache.get(changeId);
  if (hit && hit.mtime === mtime) return hit.ok;

  let ok: boolean | null = true;
  const expected: string[] = [];
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const specFile = join(base, d.name, "spec.md");
    if (!existsSync(specFile)) continue;
    const spec = readFileSync(specFile, "utf8");
    for (const m of spec.matchAll(/^# Spec: (.+)$/gm))
      expected.push(m[1].trim());
  }
  if (expected.length === 0) ok = null;
  else if (expected.length > 0 && existsSync(join("src", "tasks"))) {
    const symbols = taskSymbols();
    for (const cap of expected) {
      if (!symbols.includes(cap)) {
        ok = false;
        break;
      }
    }
  }
  driftCache.set(changeId, { mtime, ok, symbols: [] });
  return ok;
}
