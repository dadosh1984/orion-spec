import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { scriptsDir } from "./runtime.js";

/**
 * Spec-driven script cache (v0.39) — кэширует скрипты по хэшу спецификации.
 * Если пользователь меняет описание задачи или outputSchema — ключ меняется,
 * и LLM генерирует новый скрипт. Если спецификация та же — hit кэша.
 *
 * Кэш живёт в ~/.orion/scripts/.cache/<hash>.json
 * Каждая запись: { key, name, description, createdAt, hitCount }
 */

interface CacheEntry {
  key: string;
  scriptName: string;
  specHash: string;
  createdAt: string;
  lastHit: string;
  hitCount: number;
}

const MAX_CACHE_ENTRIES = 100;

export function cacheDir(): string {
  return join(scriptsDir(), ".cache");
}

export function specHash(spec: { description: string; outputSchema?: unknown }): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);
}

export function readCacheEntry(hash: string): CacheEntry | null {
  try {
    const path = join(cacheDir(), `${hash}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as CacheEntry;
  } catch {
    return null;
  }
}

export function writeCacheEntry(entry: CacheEntry): void {
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${entry.key}.json`), JSON.stringify(entry, null, 2), "utf8");

  // Prune oldest entries if over limit
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        mtime: existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8").length : 0,
      }));
    if (files.length > MAX_CACHE_ENTRIES) {
      const sorted = files
        .map((f) => {
          try {
            const e = JSON.parse(readFileSync(join(dir, f.name), "utf8")) as CacheEntry;
            return { name: f.name, ts: new Date(e.lastHit).getTime() };
          } catch {
            return { name: f.name, ts: 0 };
          }
        })
        .sort((a, b) => a.ts - b.ts);
      for (const { name } of sorted.slice(0, files.length - MAX_CACHE_ENTRIES)) {
        try { unlinkSync(join(dir, name)); } catch { /* ok */ }
      }
    }
  } catch {
    /* best effort */
  }
}

/** Find cached script by spec hash. Returns script name or null. */
export function findCachedScript(spec: { description: string; outputSchema?: unknown }): string | null {
  const hash = specHash(spec);
  const entry = readCacheEntry(hash);
  if (entry) {
    // Update hit stats
    entry.lastHit = new Date().toISOString();
    entry.hitCount++;
    writeCacheEntry(entry);
    // Verify the script still exists
    if (existsSync(join(scriptsDir(), entry.scriptName, "orion.json"))) {
      return entry.scriptName;
    }
  }
  return null;
}

/** Record a new cache entry linking spec hash to a script. */
export function recordCachedScript(
  scriptName: string,
  spec: { description: string; outputSchema?: unknown },
): void {
  const hash = specHash(spec);
  const entry: CacheEntry = {
    key: hash,
    scriptName,
    specHash: hash,
    createdAt: new Date().toISOString(),
    lastHit: new Date().toISOString(),
    hitCount: 1,
  };
  writeCacheEntry(entry);
}

/** List cache entries (newest first). */
export function listCacheEntries(): CacheEntry[] {
  const dir = cacheDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), "utf8")) as CacheEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is CacheEntry => e !== null)
    .sort((a, b) => new Date(b.lastHit).getTime() - new Date(a.lastHit).getTime());
}
