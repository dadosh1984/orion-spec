import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Dist freshness (v0.27): the CLI runs from dist/, so a stale build is a
 * real health problem (`orion doctor` flags it). Deterministic heuristic:
 * every built .js under dist/ must be newer than its source .ts.
 */
export function checkDistFresh(): { fresh: boolean; detail: string } {
  const src = join(process.cwd(), "src");
  const dist = join(process.cwd(), "dist");
  if (!existsSync(src) || !existsSync(dist)) {
    return {
      fresh: false,
      detail: existsSync(dist)
        ? "src/ missing — nothing to compare"
        : "dist/ missing — run: npx tsc -p tsconfig.json",
    };
  }
  const mtime = (root: string, ext: string): number => {
    let max = 0;
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(ext)) max = Math.max(max, statSync(p).mtimeMs);
      }
    };
    walk(root);
    return max;
  };
  const srcNewest = mtime(src, ".ts");
  const distNewest = mtime(dist, ".js");
  const fresh = distNewest >= srcNewest - 1000; // 1s clock skew allowance
  return {
    fresh,
    detail: fresh
      ? "dist build is newer than src"
      : `dist is stale (src ${new Date(srcNewest).toISOString()} > dist ${new Date(distNewest).toISOString()}) — run: npx tsc -p tsconfig.json`,
  };
}
