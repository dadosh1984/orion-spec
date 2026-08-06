import { readFileSync } from "node:fs";
import { sha256 } from "../utils/hash.js";
import { resolveConfig } from "../utils/file.js";
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

/** Resolve a stage result (string or { code }) to plain source. */
function toCode(next: string | { code: string }): string {
  return typeof next === "string" ? next : next.code;
}

/** Load the ordered stage list from `src/config/orionScale.json`. */
export function loadStages(): ScaleStageName[] {
  try {
    const cfg = JSON.parse(
      readFileSync(resolveConfig("orionScale.json"), "utf8"),
    ) as ScaleConfig;
    return cfg.stages;
  } catch {
    return ["yagni", "reuse", "stdlib", "native", "dep", "oneLiner", "minimum"];
  }
}

/** One stage's output during a scale preview. */
export interface ScaleStagePreview {
  name: ScaleStageName;
  changed: boolean;
  result: string;
}

/** Full preview of the ladder without persisting anything. */
export interface ScalePreview {
  stages: ScaleStagePreview[];
  final: string;
}

/**
 * Run the ladder and report each stage's output so the CLI can render a
 * diff-preview for `--dry` runs. Caching is disabled on purpose: a preview
 * must reflect what WOULD happen right now.
 */
export async function previewScale(code: string): Promise<ScalePreview> {
  let current = code;
  const stages: ScaleStagePreview[] = [];
  for (const stage of loadStages()) {
    const handlerFn = STAGE_HANDLERS[stage];
    if (!handlerFn) continue;
    const next = await handlerFn(current);
    const result = toCode(next);
    stages.push({ name: stage, changed: result !== current, result });
    current = result;
  }
  return { stages, final: current };
}

/**
 * Apply the YAGNI ladder to a piece of code: run every configured stage
 * in order, caching each intermediate result in OrionTrack under
 * `scale:<stage>:<hash>` so identical runs cost zero tokens.
 *
 * A track instance may be injected (benchmarks, long-running hosts) so the
 * cache object is created exactly once instead of per call.
 */
export async function applyScale(
  code: string,
  opts?: { noCache?: boolean; track?: OrionTrack },
): Promise<string> {
  const track = opts?.track ?? OrionTrack.init();
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
    current = toCode(next);
    if (!opts?.noCache) track.store(key, current);
  }

  return current;
}
