#!/usr/bin/env node
/**
 * CHANGELOG/version sync gate (v0.66).
 *
 * The release process bumps `package.json` and `CHANGELOG.md` by hand, and
 * the two have drifted before (package.json at 0.66.0 while the top
 * CHANGELOG entry was still 0.65.0). This gate fails CI when the version in
 * `package.json` has no matching top entry in `CHANGELOG.md`, so a release
 * can never ship with a stale changelog.
 *
 * Rule: the first `## [x.y.z]` heading in CHANGELOG.md must equal the
 * `version` field in package.json. A pre-release suffix (`-rc.1`, `-beta`)
 * is stripped from both sides before comparison, so a release candidate
 * still matches its base version.
 *
 * Usage: node scripts/check-changelog.mjs
 * Exit 1 (honestly) when the two are out of sync.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");

const pkgVersion = String(pkg.version ?? "").trim();
if (!pkgVersion) {
  console.error("changelog-gate: package.json has no `version` field");
  process.exit(1);
}

// First `## [x.y.z]` heading, newest-first.
const topMatch = changelog.match(/^##\s+\[([^\]]+)\]/m);
if (!topMatch) {
  console.error(
    "changelog-gate: no `## [x.y.z]` heading found in CHANGELOG.md",
  );
  process.exit(1);
}

const stripPrerelease = (v) => v.replace(/-[0-9A-Za-z.]+$/, "");
const pkgBase = stripPrerelease(pkgVersion);
const changelogBase = stripPrerelease(topMatch[1]);

if (pkgBase !== changelogBase) {
  console.error(
    `changelog-gate: FAIL — package.json is ${pkgVersion} but the top CHANGELOG entry is [${topMatch[1]}]`,
  );
  console.error(
    "  Add a `## [<version>]` entry at the top of CHANGELOG.md before releasing.",
  );
  process.exit(1);
}

console.log(
  `changelog-gate: PASS — package.json ${pkgVersion} matches top CHANGELOG entry [${topMatch[1]}]`,
);
