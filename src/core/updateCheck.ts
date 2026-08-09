import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readVersionSafe } from "../utils/version.js";

/**
 * Offline-safe, non-blocking update check (v0.36).
 *
 * `orion mcp` users (AI agents) should learn when a release drops without
 * blocking the protocol handshake. The check:
 *   - looks up the installed version from package.json;
 *   - optionally queries the npm registry for the latest (with a timeout,
 *     2.5s) and caches the result under ~/.orion for a day;
 *   - on any failure (no network, rate limit) it stays silent — an update
 *     check must NEVER delay or break a connect.
 * Disable with ORION_UPDATE_CHECK=0 (or let the 2.5s timeout cover you).
 */

export interface UpdateInfo {
  installed: string;
  latest: string | null;
  updateAvailable: boolean;
  /** "unknown" when the registry check did not complete. */
  status: "ok" | "offline" | "disabled";
}

const cachePath = join(homedir(), ".orion", "update-check.json");
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 2500;

export function updateCheckEnabled(): boolean {
  return process.env.ORION_UPDATE_CHECK !== "0";
}

export function installedVersion(): string {
  return readVersionSafe();
}

export function readCachedUpdate(): UpdateInfo | null {
  try {
    if (!existsSync(cachePath)) return null;
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as {
      ts: number;
      latest: string;
    };
    if (!raw.latest || Date.now() - raw.ts > DAY_MS) return null;
    return {
      installed: installedVersion(),
      latest: raw.latest,
      updateAvailable: raw.latest !== installedVersion(),
      status: "ok",
    };
  } catch {
    return null;
  }
}

/** Async, bounded registry probe. Never throws. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const installed = installedVersion();
  if (!updateCheckEnabled()) {
    return { installed, latest: null, updateAvailable: false, status: "disabled" };
  }
  const cached = readCachedUpdate();
  if (cached) return cached;
  try {
    const res = await Promise.race([
      fetch("https://registry.npmjs.org/orion-spec/latest", {
        headers: { accept: "application/vnd.npm.install-v1+json" },
      }).then((r) => r.json()),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
      ),
    ]);
    const latest = (res as { version?: string }).version ?? null;
    if (latest) {
      try {
        writeFileSync(
          cachePath,
          JSON.stringify({ ts: Date.now(), latest }),
          "utf8",
        );
      } catch {
        /* cache is best-effort */
      }
    }
    return {
      installed,
      latest,
      updateAvailable: !!latest && latest !== installed,
      status: latest ? "ok" : "offline",
    };
  } catch {
    return { installed, latest: null, updateAvailable: false, status: "offline" };
  }
}

/** Human line for the stderr banner (safe when offline). */
export function updateBanner(info: UpdateInfo): string {
  const base = `orion v${info.installed}`;
  if (info.updateAvailable && info.latest) {
    return `${base} → update available: v${info.latest} (npm i -g orion-spec@${info.latest})`;
  }
  if (info.status === "ok") return `${base} (latest)`;
  return base;
}
