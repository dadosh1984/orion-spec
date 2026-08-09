import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCapped } from "../utils/file.js";

/**
 * Verifiability assessment (idea adapted from a sibling toolkit, implemented
 * here in orion's own zero-dependency style — nothing copied).
 *
 * Deterministically probes a target repository for *verification oracles*
 * (a test runner, a type-checker, a linter, a CI setup) and decides how
 * strongly an automated guard verdict can be trusted. The point is honesty:
 * a `shield` PASS on a repo with no tests, no type-check and no lint is
 * NOT the same strength as one with all three — so we say so.
 */

export type OracleKind = "test-runner" | "type-check" | "lint" | "ci";

/** 0 = nothing verifiable … 3 = tests + assertions (type/lint present). */
export type VerifiabilityLevel = 0 | 1 | 2 | 3;

/** Directories never treated as test sources (defensive speed-up). */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".orion",
]);

/** Files that read like test files. */
const TEST_FILE_RE = /\.(test|spec)\.([cm]?[jt]sx?|ts|js|mjs|mts)$/;

/** Assertion / test-body tokens that make a test file "meaningful". */
const ASSERT_RE = /\b(test|it|expect|assert|describe|should)\b/;

/** Collect candidate test-file paths under a directory (skipping heavy dirs). */
function collectTestFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectTestFiles(full, out);
    } else if (TEST_FILE_RE.test(name)) {
      out.push(full);
    }
  }
}

/**
 * True when the repo has at least one test file containing a real
 * assertion/test token — i.e. tests that verify something, not stubs.
 */
export function hasMeaningfulTests(root: string): boolean {
  const files: string[] = [];
  collectTestFiles(root, files);
  for (const f of files) {
    if (ASSERT_RE.test(readCapped(f))) return true;
  }
  return false;
}

/**
 * Map detected oracles + test meaningfulness to a verifiability level 0–3:
 * - 3 — a test runner AND meaningful assertions exist (strongest evidence)
 * - 2 — a test runner, type-check or lint is present (some determinism)
 * - 1 — only CI (indirect signal)
 * - 0 — nothing verifiable (an automated PASS is weakest here)
 */
export function mapLevel(
  oracles: OracleKind[],
  testsMeaningful: boolean,
): VerifiabilityLevel {
  const set = new Set(oracles);
  if (set.has("test-runner")) return testsMeaningful ? 3 : 2;
  if (set.has("type-check") || set.has("lint")) return 2;
  if (set.has("ci")) return 1;
  return 0;
}

/** A single probe for one oracle kind against the target root. */
export interface Probe {
  kind: OracleKind;
  /** Filenames in the root that imply this oracle. */
  files: string[];
  /** package.json script names that imply this oracle. */
  scripts: string[];
  /** Optional directory whose presence implies this oracle. */
  dir?: string;
}

const DEFAULT_PROBES: Probe[] = [
  {
    kind: "test-runner",
    files: [
      "vitest.config.ts",
      "vitest.config.js",
      "vitest.config.mts",
      "vitest.config.mjs",
      "jest.config.ts",
      "jest.config.js",
      "playwright.config.ts",
      "playwright.config.js",
    ],
    scripts: ["test"],
  },
  {
    kind: "type-check",
    files: ["tsconfig.json"],
    scripts: ["typecheck", "type-check"],
  },
  {
    kind: "lint",
    files: [
      "eslint.config.js",
      "eslint.config.ts",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "biome.json",
      ".eslintrc",
      ".eslintrc.json",
    ],
    scripts: ["lint"],
  },
  { kind: "ci", files: [], scripts: ["ci"], dir: ".github/workflows" },
];

/** Probe a repository root for verification oracles. */
export function probeOracles(root = process.cwd()): OracleKind[] {
  const found: OracleKind[] = [];
  for (const probe of DEFAULT_PROBES) {
    const file = probe.files.some((f) => existsSync(join(root, f)));
    let dir = false;
    if (probe.dir) {
      try {
        dir = existsSync(join(root, probe.dir));
      } catch {
        dir = false;
      }
    }
    let script = false;
    if (probe.scripts.length > 0) {
      try {
        const pkg = JSON.parse(readCapped(join(root, "package.json"))) as {
          scripts?: Record<string, unknown>;
        };
        script = probe.scripts.some(
          (s) => (pkg.scripts ?? {})[s] !== undefined,
        );
      } catch {
        script = false;
      }
    }
    if (file || dir || script) found.push(probe.kind);
  }
  return found.sort();
}

/** Full verifiability report for a repository root. */
export function assessVerifiability(root = process.cwd()): {
  oracles: OracleKind[];
  testsMeaningful: boolean;
  level: VerifiabilityLevel;
} {
  const oracles = probeOracles(root);
  const testsMeaningful = hasMeaningfulTests(root);
  return {
    oracles,
    testsMeaningful,
    level: mapLevel(oracles, testsMeaningful),
  };
}
