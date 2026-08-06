import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sha256 } from "../utils/hash.js";
import { OrionTrack } from "./track.js";
import type { ScaleConfig, ScaleStageName } from "../type.js";
import { handler as yagni } from "../scaleStages/yagni.js";
import { handler as reuse } from "../scaleStages/reuse.js";
import { handler as stdlib } from "../scaleStages/stdlib.js";
import { handler as native } from "../scaleStages/native.js";
import { handler as dep } from "../scaleStages/dep.js";
import { handler as oneLiner } from "../scaleStages/oneLiner.js";
import { handler as minimum } from "../scaleStages/minimum.js";

const STAGE_HANDLERS: Record<
  ScaleStageName,
  (code: string) => string | Promise<string>
> = {
  yagni,
  reuse,
  stdlib,
  native,
  dep: (code) => {
    const r = dep(code);
    return typeof r === "string" ? r : r.code;
  },
  oneLiner,
  minimum,
};

/** SHA-256 hash of a piece of code — used as the scale cache key fragment. */
export function hashCode(code: string): string {
  return sha256(code);
}

/** Load the ordered stage list from `src/config/orionScale.json`. */
export function loadStages(): ScaleStageName[] {
  try {
    const cfg = JSON.parse(
      readFileSync(resolve("src/config/orionScale.json"), "utf8"),
    ) as ScaleConfig;
    return cfg.stages;
  } catch {
    return ["yagni", "reuse", "stdlib", "native", "dep", "oneLiner", "minimum"];
  }
}

/**
 * Apply the YAGNI ladder to a piece of code: run every configured stage
 * in order, caching each intermediate result in OrionTrack under
 * `scale:<stage>:<hash>` so identical runs cost zero tokens.
 */
export async function applyScale(
  code: string,
  opts?: { noCache?: boolean },
): Promise<string> {
  const track = OrionTrack.init();
  let current = code;
  const stages = loadStages();

  for (const stage of stages) {
    const key = `scale:${stage}:${hashCode(current)}`;
    if (!opts?.noCache) {
      const cached = track.loadString(key);
      if (cached !== null) {
        current = cached;
        continue;
      }
    }
    const handlerFn = STAGE_HANDLERS[stage];
    if (!handlerFn) continue;
    const next = await handlerFn(current);
    current = typeof next === "string" ? next : next;
    if (!opts?.noCache) track.store(key, current);
  }

  return current;
}
