import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";

/** Read a text file; throws if the file does not exist. */
export async function readFileSafe(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** Write a text file, creating parent directories on demand. */
export async function writeFileSafe(path: string, data: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, data, "utf8");
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
