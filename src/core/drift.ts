import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { detectAdapter } from "./shield/adapter.js";

/**
 * Shared drift gate (v0.37) — extracted from serve.ts so both the dashboard
 * and review/handler.ts reuse the same deterministic logic. Memoized by
 * change directory mtime; a stat-only cache that invalidates on any edit.
 *
 * v0.58: supports Python adapter for drift check.
 */

const SYMBOL =
  /^export (?:const|function|class)\s+([A-Za-z0-9_$]+)\s*(?:=|\()/gm;

/** Python symbols: def, class, async def at top level */
const PY_SYMBOL =
  /^(?:async\s+)?(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm;

const driftCache = new Map<
  string,
  { mtime: number; ok: boolean | null; symbols: string[] }
>();
const DRIFT_CACHE_MAX = 100;

function pruneDriftCache(): void {
  if (driftCache.size > DRIFT_CACHE_MAX) {
    const iter = driftCache.keys();
    for (let i = 0; i < 10 && driftCache.size > DRIFT_CACHE_MAX; i++) {
      const key = iter.next().value;
      if (key !== undefined) driftCache.delete(key);
    }
  }
}

/** Symbols exported from src/tasks/* (cached by directory mtime).
 *  Supports Python adapter: scans .py files when Python is detected. */
export function taskSymbols(cwd = process.cwd()): string[] {
  const adapter = detectAdapter(cwd);
  const ext = adapter?.id === "python" ? ".py" : ".ts";
  const dir = join(cwd, "src", "tasks");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(ext));
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
  const re = ext === ".py" ? PY_SYMBOL : SYMBOL;
  for (const f of files) {
    const code = readFileSync(join(dir, f), "utf8");
    for (const m of code.matchAll(re)) out.push(m[1]);
  }
  driftCache.set(cacheKey, { mtime, ok: null, symbols: out });
  pruneDriftCache();
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
  pruneDriftCache();
  return ok;
}
