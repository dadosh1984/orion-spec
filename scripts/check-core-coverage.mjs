#!/usr/bin/env node
/**
 * Core-pipeline coverage gate (v0.19, hardened v0.20).
 *
 * The global vitest threshold is 80% lines. The modules below are the ones
 * every other part of the pipeline depends on, so they get a stricter,
 * per-file floor on top of the global gate. Absolute path prefixes in the
 * coverage JSON are ignored when matching (they differ on Windows/macOS/Linux).
 *
 * Input: `coverage/coverage-final.json` by default (what the v8 provider
 * reliably writes). vitest 4.1.10's "json-summary" reporter creates no
 * output file at all, so the gate derives the same per-file line
 * percentages itself: a line is covered when at least one statement on it
 * has a hit count > 0 (this mirrors istanbul's own line accounting). A
 * summary-format file (`lines: {total, covered, pct}`) is also accepted,
 * so an explicit arg keeps working either way.
 *
 * Usage: node scripts/check-core-coverage.mjs [coverage-final.json|coverage-summary.json]
 * Exit 1 (honestly) when a core module drops below its floor.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const coveragePath =
  process.argv[2] ?? join(root, "coverage", "coverage-final.json");

/** module basename → minimum lines-coverage percent. */
const FLOORS = {
  "src/core/track.ts": 90,
  "src/core/scale.ts": 95,
  "src/core/tddCore.ts": 85,
};

let coverage;
try {
  coverage = JSON.parse(readFileSync(coveragePath, "utf8"));
} catch (err) {
  console.error(
    `core-coverage: cannot read ${coveragePath} — run \`pnpm run test:coverage\` first (${err.message})`,
  );
  process.exit(1);
}

/**
 * Line coverage from an istanbul coverage entry. `coverage-final.json`
 * entries carry `statementMap` + `s` (hit counts) instead of a precomputed
 * `lines` summary — derive it the same way istanbul does.
 */
function linePct(entry) {
  // A summary-format entry already has the figure.
  const summary = entry?.lines;
  if (typeof summary?.pct === "number") return summary.pct;
  if (typeof summary?.covered === "number" && typeof summary?.total === "number") {
    return summary.total === 0
      ? 100
      : Math.round((summary.covered / summary.total) * 10000) / 100;
  }
  const sm = entry?.statementMap ?? {};
  const hits = entry?.s ?? {};
  const lines = new Set();
  const coveredLines = new Set();
  for (const id of Object.keys(sm)) {
    const line = sm[id]?.start?.line;
    if (typeof line !== "number") continue;
    lines.add(line);
    if ((hits[id] ?? 0) > 0) coveredLines.add(line);
  }
  if (lines.size === 0) return null;
  return Math.round((coveredLines.size / lines.size) * 10000) / 100;
}

const failures = [];
for (const [module, floor] of Object.entries(FLOORS)) {
  // Keys are absolute paths (backslashes on Windows); match by the
  // relative suffix after normalising separators.
  const entry = Object.entries(coverage).find(([key]) =>
    key.replaceAll("\\", "/").endsWith(module),
  );
  if (!entry) {
    failures.push(`  ${module}: NOT COVERED (missing from coverage)`);
    continue;
  }
  const pct = linePct(entry[1]);
  if (typeof pct !== "number") {
    failures.push(`  ${module}: no line figures in coverage`);
    continue;
  }
  if (pct < floor) {
    failures.push(
      `  ${module}: ${pct.toFixed(2)}% < required ${floor}% (core gate)`,
    );
  }
}

if (failures.length > 0) {
  console.error("core-coverage: FAIL — core modules dropped below their floor:");
  failures.forEach((f) => console.error(f));
  process.exit(1);
}

console.log(
  `core-coverage: PASS — all core modules meet their floor (${
    Object.keys(FLOORS).length
  } file(s))`,
);
