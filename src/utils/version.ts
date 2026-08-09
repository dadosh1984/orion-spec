import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Read package.json version safely (v0.36). Resolves relative to this
 * module so it works in any install (global pnpm, npm, source dist).
 * Returns "0.0.0" on any failure — the caller never crashes on version. */
export function readVersionSafe(): string {
  try {
    const pkgPath = fileURLToPath(
      new URL("../../package.json", import.meta.url),
    );
    const raw = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return raw.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
