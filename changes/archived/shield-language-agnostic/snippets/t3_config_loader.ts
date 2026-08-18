// === T3: Config loader (orionShield.json) ===
// ponytail: rung-2 — config loader, reuses existing patterns from orionTdd.json

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ShieldConfig {
  /** Explicit language override; if absent, auto-detect */
  language?: string;
  /** Per-step command overrides */
  shield?: {
    lint?: { cmd: string; args: string[] };
    typeCheck?: { cmd: string; args: string[] };
    test?: { cmd: string; args: string[] };
    /** Path to drift extractor script */
    driftExtractor?: string;
  };
  /** Security patterns (regex sources) */
  security?: {
    patterns: string[];
  };
}

const CONFIG_FILE = ".orion/shield.json";

/** Load orionShield.json from cwd; missing/invalid → null */
export function loadShieldConfig(cwd = process.cwd()): ShieldConfig | null {
  const p = join(cwd, CONFIG_FILE);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    const cfg = JSON.parse(raw) as ShieldConfig;
    if (!cfg || typeof cfg !== "object") return null;
    return cfg;
  } catch {
    return null;
  }
}

/** Resolve shield config: merge file config with adapter defaults */
export function resolveConfig(cwd = process.cwd()): {
  language: string | null;
  overrides: ShieldConfig;
} {
  const cfg = loadShieldConfig(cwd);
  if (!cfg) return { language: null, overrides: {} };
  return {
    language: cfg.language ?? null,
    overrides: {
      shield: cfg.shield,
      security: cfg.security,
    },
  };
}
