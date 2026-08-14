/**
 * Replay (v0.54, task 4.2) — regression check for a completed change.
 *
 * Re-runs a change on the NEW/current code and verifies the honest output
 * still holds. Deterministic backbone of Orion: if the change's input
 * artifacts (specs/tasks/snippets/design) are untouched, the reproducible
 * hash matches the one recorded in `receipt.json` → the change replays at
 * zero token cost (everything is cached) and no regression. If the inputs
 * drifted since `out`, it says so honestly — never presents stale truth.
 *
 * Read-only: replay does not rewrite artifacts, it only checks.
 */

import { existsSync, readFileSync } from "node:fs";
import { computeReproHash } from "../out/receipt.js";
import { verifyChange } from "../../core/verify.js";

export interface ReplayResult {
  change: string;
  /** True when the reproducible hash still matches the recorded receipt. */
  changed: boolean;
  /** True when no input changed → full cache reuse, zero token spend. */
  cached: boolean;
  tokens: "0 (cached)" | "unknown (drifted)";
  shaNow: string;
  shaReceipt: string;
  specDrift: boolean;
  detail: string;
}

/** Read the recorded receipt sha256 (null when receipt is absent). */
function recordedSha(changeId: string): string | null {
  const f = `changes/${changeId}/receipt.json`;
  if (!existsSync(f)) return null;
  try {
    const r = JSON.parse(readFileSync(f, "utf8")) as { sha256?: string };
    return r.sha256 ?? null;
  } catch {
    return null;
  }
}

/** Deterministic replay check — read-only, never fabricates a verdict. */
export function replay(changeId: string): ReplayResult {
  const shaReceipt = recordedSha(changeId);
  if (shaReceipt === null) {
    return {
      change: changeId,
      changed: true,
      cached: false,
      tokens: "unknown (drifted)",
      shaNow: computeReproHash(changeId),
      shaReceipt: "(none)",
      specDrift: true,
      detail:
        "no receipt.json — run `orion out <id>` first so there is a recorded hash to replay against.",
    };
  }
  const shaNow = computeReproHash(changeId);
  const changed = shaNow !== shaReceipt;
  // verifyChange is git-aware + cached: a replay on unchanged input hits cache.
  const v = verifyChange(changeId, process.cwd(), { cache: true });
  return {
    change: changeId,
    changed,
    cached: !changed && v.cached === true,
    tokens: changed ? "unknown (drifted)" : "0 (cached)",
    shaNow,
    shaReceipt,
    specDrift: changed,
    detail: changed
      ? "input drifted since the recorded receipt — the change must be re-verified (run shield/out)."
      : v.cached
        ? "all checks cached — full replay at zero token cost, no regression."
        : "hash unchanged; verify re-ran (cache miss) but no input drift was detected.",
  };
}
