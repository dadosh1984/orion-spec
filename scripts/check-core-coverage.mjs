#!/usr/bin/env node
/**
 * Core-pipeline coverage gate (v0.19).
 *
 * The global vitest threshold is 80% lines. The modules below are the ones
 * every other part of the pipeline depends on, so they get a stricter,
 * per-file floor on top of the global gate. Absolute path prefixes in
 * coverage/coverage-summary.json are ignored when matching (they differ on
 * Windows/macOS/Linux).
 *
 * Usage: node scripts/check-core-coverage.mjs [coverage-summary.json]
 * Exit 1 (honestly) when a core module drops below its floor.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath =
  process.argv[2] ?? join(root, "coverage", "coverage-summary.json");

/** module basename → minimum lines-coverage percent. */
const FLOORS = {
  "src/core/track.ts": 90,
  "src/core/scale.ts": 95,
  "src/core/tddCore.ts": 85,
};

let summary;
try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch (err) {
  console.error(
    `core-coverage: cannot read ${summaryPath} — run \`pnpm run test:coverage\` first (${err.message})`,
  );
  process.exit(1);
}

const failures = [];
for (const [module, floor] of Object.entries(FLOORS)) {
  // coverage-summary keys are absolute paths (backslashes on Windows);
  // match by the relative suffix after normalising separators.
  const entry = Object.entries(summary).find(([key]) =>
    key.replaceAll("\\", "/").endsWith(module),
  );
  if (!entry) {
    failures.push(`  ${module}: NOT COVERED (missing from summary)`);
    continue;
  }
  const pct = entry[1]?.lines?.pct;
  if (typeof pct !== "number") {
    failures.push(`  ${module}: no lines figure in summary`);
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
