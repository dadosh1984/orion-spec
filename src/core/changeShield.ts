/**
 * Change-level shield — checks the artifacts of a single change (v0.57).
 * It does not replace project-wide `orion shield`, but complements it for
 * per-change guards: hazard-scan of snippets, spec drift, test gate.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { scanHazards } from "./hazards.js";
import { driftOf } from "./drift.js";
import { type Store, memoryStore } from "./store.js";
import { detectAdapter, registerAdapter } from "./shield/adapter.js";
import { TypeScriptAdapter } from "./shield/typescript.js";
import { GradleAdapter } from "./shield/gradle.js";

export interface ChangeShieldResult {
  ok: boolean;
  changeId: string;
  hazards: string[];
  drift: boolean | null;
  ts: string;
}

let _cache: Store<ChangeShieldResult> | null = null;

function getCache(): Store<ChangeShieldResult> {
  return (_cache ??= memoryStore<ChangeShieldResult>());
}

/** Override cache store for tests. */
export function setShieldCache(store: Store<ChangeShieldResult>): void {
  _cache = store;
}

/** Run change-level shield: hazard scan + drift check. */
export async function runChangeShield(
  changeId: string,
): Promise<ChangeShieldResult> {
  const changeDir = join(process.cwd(), "changes", changeId);
  if (!existsSync(changeDir)) {
    return {
      ok: false,
      changeId,
      hazards: [],
      drift: null,
      ts: new Date().toISOString(),
    };
  }

  // 1. Hazard-scan snippets (extensions from adapter)
  const snippetsDir = join(changeDir, "snippets");
  const hazards: string[] = [];
  // Register adapters if not yet registered
  registerAdapter(GradleAdapter);
  registerAdapter(TypeScriptAdapter);
  const adapter = detectAdapter(process.cwd());
  const exts =
    adapter?.id === "gradle"
      ? [".java"]
      : adapter?.id === "python"
        ? [".py"]
        : [".ts", ".js"];
  if (existsSync(snippetsDir)) {
    for (const f of readdirSync(snippetsDir)) {
      if (!exts.some((e) => f.endsWith(e))) continue;
      const src = readFileSync(join(snippetsDir, f), "utf8");
      hazards.push(...scanHazards(src));
    }
  }

  // 2. Spec drift (reuses driftOf which compares spec headings ↔ exported symbols)
  const drift: boolean | null = driftOf(changeId);

  const ok = hazards.length === 0 && drift !== false;
  const result: ChangeShieldResult = {
    ok,
    changeId,
    hazards,
    drift,
    ts: new Date().toISOString(),
  };

  getCache().append(result);
  return result;
}
