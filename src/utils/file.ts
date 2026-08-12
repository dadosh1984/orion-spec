import {
  mkdir,
  readFile,
  writeFile,
  rename as renameFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Write a text file, creating parent directories on demand. */
export async function writeFileSafe(path: string, data: string): Promise<void> {
  await ensureDir(dirname(path));
  // Atomic write (v0.34): write to a temp file in the same directory then
  // rename, so a crash/power-loss between open and write never leaves a
  // half-written artifact that parses as a corrupt ledger/json.
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, data, "utf8");
  await renameFile(tmp, path);
}

/** Recursively create a directory if it does not exist yet. */
export async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/** Synchronously check whether a file or directory exists. */
export function exists(path: string): boolean {
  return existsSync(path);
}

/** Write a JSON file with pretty formatting. */
export async function writeJson(file: string, obj: unknown): Promise<void> {
  await writeFileSafe(file, JSON.stringify(obj, null, 2));
}

/** Read and parse a JSON file. Returns null if parsing fails. */
export async function readJson<T>(file: string): Promise<T | null> {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve a config file. A project-local `src/config/<name>` wins (so per-
 * project customization keeps working from any cwd), otherwise fall back to
 * the installed package's own copy — which makes global installs
 * (`npm i -g orion-spec`) functional outside the repo root.
 */
export function resolveConfig(name: string): string {
  const local = join(process.cwd(), "src", "config", name);
  if (existsSync(local)) return local;
  return fileURLToPath(new URL(`../../src/config/${name}`, import.meta.url));
}

/** Max default bytes for `readCapped` evidence lookups. */
export const READ_CAPPED_DEFAULT = 64 * 1024;

/**
 * Read a file but only the first `maxBytes` bytes (v0.30). Never lets a
 * huge file stall an evidence scan. Fails safe: missing/unreadable → "".
 */
export function readCapped(
  file: string,
  maxBytes = READ_CAPPED_DEFAULT,
): string {
  try {
    const buf = readFileSync(file);
    return buf.subarray(0, maxBytes).toString("utf8");
  } catch {
    return "";
  }
}

/** Human-readable byte size (123 B, 45.6 KB, 1.2 MB). */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Options for `collectTsFiles`. */
export interface CollectTsOptions {
  /** Maximum directory depth (default: unlimited). */
  depth?: number;
  /** Include `.tsx` files (default: false). */
  tsx?: boolean;
  /** Directories to skip (default: node_modules, dist, .git). */
  skipDirs?: string[];
}

const DEFAULT_SKIP_DIRS = ["node_modules", "dist", ".git"];

/**
 * Recursively collect `.ts` (and optionally `.tsx`) files from a directory.
 * Unified from `scaleStages/reuse.ts` and `skills/shield/policy.ts` (v0.46).
 */
export function collectTsFiles(
  dir: string,
  opts: CollectTsOptions = {},
): string[] {
  const {
    depth = Infinity,
    tsx = false,
    skipDirs = DEFAULT_SKIP_DIRS,
  } = opts;
  if (depth < 0) return [];
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (skipDirs.includes(e)) continue;
    const full = join(dir, e);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...collectTsFiles(full, { depth: depth - 1, tsx, skipDirs }));
      } else if (
        e.endsWith(".ts") ||
        (tsx && e.endsWith(".tsx"))
      ) {
        out.push(full);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}
