import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { resolveConfig } from "../utils/file.js";
import type { TrackConfig, TrackStats } from "../type.js";

/** Cache entry persisted on disk: the stored value plus a timestamp. */
interface CacheEntry {
  value: unknown;
  storedAt: string;
}

/**
 * OrionTrack — the token-economy cache.
 *
 * Stores stdout/stderr/artifacts of every expensive command in
 * `~/.orion/cache` so identical runs never pay tokens twice.
 */
export class OrionTrack {
  readonly cacheDir: string;
  private readonly configPath: string;

  constructor(cacheDir?: string, configPath?: string) {
    this.cacheDir = cacheDir ?? join(homedir(), ".orion", "cache");
    this.configPath = configPath ?? resolveConfig("orionTrack.json");
    mkdirSync(this.cacheDir, { recursive: true });
  }

  /**
   * Load config (defaults: 100 MB, 30 days TTL) and return a fresh instance.
   * The cache directory can be overridden via ORION_CACHE_DIR (used by tests
   * and by `--no-cache`-style isolation).
   */
  static init(cacheDir?: string): OrionTrack {
    const dir = cacheDir ?? process.env.ORION_CACHE_DIR ?? undefined;
    const instance = new OrionTrack(dir);
    instance.config();
    return instance;
  }

  /**
   * Resolve the on-disk path of a cache key. Keys are URI-encoded so
   * namespaced keys like `scale:yagni:<hash>` survive Windows' filename
   * restrictions (colons are illegal there).
   */
  entryPath(key: string): string {
    return join(this.cacheDir, `${encodeURIComponent(key)}.json`);
  }

  /** Persist a value under a key with the current timestamp. */
  store(key: string, value: unknown): void {
    const entry: CacheEntry = { value, storedAt: new Date().toISOString() };
    writeFileSync(this.entryPath(key), JSON.stringify(entry, null, 2), "utf8");
  }

  /** Load a value; returns null when the key is missing or corrupt. */
  load(key: string): unknown {
    const file = this.entryPath(key);
    if (!existsSync(file)) return null;
    try {
      const entry = JSON.parse(readFileSync(file, "utf8")) as CacheEntry;
      return entry.value;
    } catch {
      return null;
    }
  }

  /** Load a value as a string, or null. */
  loadString(key: string): string | null {
    const value = this.load(key);
    return typeof value === "string" ? value : null;
  }

  /** Load a value together with its stored timestamp, or null. */
  loadWithDate(key: string): { value: unknown; storedAt: string } | null {
    const file = this.entryPath(key);
    if (!existsSync(file)) return null;
    try {
      const entry = JSON.parse(readFileSync(file, "utf8")) as CacheEntry;
      return { value: entry.value, storedAt: entry.storedAt };
    } catch {
      return null;
    }
  }

  /** Check whether a key exists on disk. */
  exists(key: string): boolean {
    return existsSync(this.entryPath(key));
  }

  /** Delete specific keys (used by `forge` after code changes). */
  invalidate(keys: string[]): void {
    for (const key of keys) {
      const file = this.entryPath(key);
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch {
          /* best effort */
        }
      }
    }
  }

  /** Parallel-load multiple keys into a { key: value } object. */
  async batch(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    await Promise.all(
      keys.map(async (key) => {
        const value = this.load(key);
        if (value !== null) result[key] = value;
      }),
    );
    return result;
  }

  /** Read the track configuration with defaults. */
  config(): TrackConfig {
    if (!existsSync(this.configPath)) {
      return { maxSize: 104857600, ttlDays: 30 };
    }
    try {
      const raw = JSON.parse(
        readFileSync(this.configPath, "utf8"),
      ) as Partial<TrackConfig>;
      return {
        maxSize: raw.maxSize ?? 104857600,
        ttlDays: raw.ttlDays ?? 30,
      };
    } catch {
      return { maxSize: 104857600, ttlDays: 30 };
    }
  }

  /**
   * Remove expired (past TTL) entries, then drop oldest files until the
   * total size fits within maxSize. Returns the number of removed files.
   */
  prune(): number {
    const { maxSize, ttlDays } = this.config();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let removed = 0;

    const files = readdirSync(this.cacheDir).filter((f) => f.endsWith(".json"));
    const stats = files.map((f) => {
      const full = join(this.cacheDir, f);
      let mtime = 0;
      let size = 0;
      try {
        const st = statSync(full);
        mtime = st.mtimeMs;
        size = st.size;
      } catch {
        /* ignore */
      }
      return { name: f, full, mtime, size };
    });

    // 1) TTL-based removal
    for (const f of stats) {
      if (ttlMs > 0 && now - f.mtime > ttlMs) {
        try {
          unlinkSync(f.full);
        } catch {
          /* ignore */
        }
        removed++;
      }
    }

    // 2) Size-based removal (oldest first)
    const remaining = stats
      .filter((f) => existsSync(f.full))
      .sort((a, b) => a.mtime - b.mtime);
    let total = remaining.reduce((sum, f) => sum + f.size, 0);
    for (const f of remaining) {
      if (total <= maxSize) break;
      try {
        unlinkSync(f.full);
        removed++;
      } catch {
        /* ignore */
      }
      total -= f.size;
    }

    return removed;
  }

  /** List all cache keys currently on disk (decoded). */
  keys(): string[] {
    return readdirSync(this.cacheDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .map((k) => {
        try {
          return decodeURIComponent(k);
        } catch {
          return k;
        }
      });
  }

  /** Remove the entire cache directory contents. */
  clear(): void {
    for (const f of readdirSync(this.cacheDir)) {
      try {
        unlinkSync(join(this.cacheDir, f));
      } catch {
        /* ignore */
      }
    }
  }

  /** Aggregate statistics for the `track status` command and future UI. */
  getStats(): TrackStats {
    const files = readdirSync(this.cacheDir).filter((f) => f.endsWith(".json"));
    let size = 0;
    let newest = 0;
    for (const f of files) {
      try {
        const st = statSync(join(this.cacheDir, f));
        size += st.size;
        newest = Math.max(newest, st.mtimeMs);
      } catch {
        /* ignore */
      }
    }
    return {
      count: files.length,
      size,
      lastPrune: newest ? new Date(newest).toISOString() : null,
    };
  }
}
