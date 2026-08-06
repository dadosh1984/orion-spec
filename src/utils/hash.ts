import { createHash } from "node:crypto";

/** Compute the SHA-256 hex digest of a string. */
export const sha256 = (data: string): string =>
  createHash("sha256").update(data).digest("hex");

/** Compute the SHA-256 hex digest of a file's contents. */
export async function hashFile(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const data = await readFile(path, "utf8");
  return sha256(data);
}
