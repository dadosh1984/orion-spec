import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `orion init` (v0.28) — scaffold the local Orion configuration for a repo:
 *   - orionTdd.json    TDD engine config (src/config/orionTdd.json)
 *   - .githooks/pre-commit.sh  a pre-commit hook that runs shield on the
 *     newest open change (idempotent; opt-in via core.hooksPath)
 *   - .orion/deny.txt  guard-prompt deny-list policy template
 * Idempotent: existing files are never overwritten; the report says what
 * was created vs. already present.
 */
export interface InitResult {
  created: string[];
  existing: string[];
}

const TDD_CONFIG = `{
  "suffixes": [".ts"],
  "flaky_vars": ["PWD"]
}
`;

const PRE_COMMIT = `#!/usr/bin/env bash
# Orion pre-commit hook (scaffolded by \`orion init\`).
# Runs the deterministic change review on every change and fails loudly
# when the newest change has review issues. Edit or delete freely.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git log -1 --format="%H"
`;

const DENY = `# Orion guard-prompt deny-list policy template (\`orion init\`, v0.28).
# One pattern per line (plain substring). Any \`orion think\` prompt matching
# a deny word is blocked before a proposal is created. Remove or extend freely.
# eval
# exec(
# rm -rf
`;

export function initRepo(): InitResult {
  const created: string[] = [];
  const existing: string[] = [];
  const write = (rel: string, body: string): void => {
    const full = join(process.cwd(), rel);
    if (existsSync(full)) {
      existing.push(rel);
      return;
    }
    mkdirSync(join(process.cwd(), rel.split("/").slice(0, -1).join("/")), {
      recursive: true,
    });
    writeFileSync(full, body, "utf8");
    created.push(rel);
  };
  write("src/config/orionTdd.json", TDD_CONFIG);
  write(".orion/deny.txt", DENY);
  write(".githooks/pre-commit.sh", PRE_COMMIT);
  return { created, existing };
}
