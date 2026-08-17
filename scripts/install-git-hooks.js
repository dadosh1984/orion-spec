// Zero-dependency pre-commit hook installer (CODE-4).
// Cross-platform (Windows + Unix): writes .git/hooks/pre-commit that runs
// format:check + lint before every commit. Idempotent.
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";

const hookDir = execSync("git rev-parse --git-path hooks", {
  encoding: "utf8",
}).trim();
mkdirSync(hookDir, { recursive: true });

const hook = join(hookDir, "pre-commit");
const content = `#!/usr/bin/env sh
set -e
echo "[pre-commit] format:check + lint ..."
pnpm run format:check >/dev/null 2>&1 || { echo "[pre-commit] FAIL: code is not formatted. Run: pnpm run format"; exit 1; }
pnpm run lint >/dev/null 2>&1 || { echo "[pre-commit] FAIL: lint errors. Run: pnpm run lint"; exit 1; }
echo "[pre-commit] OK"
`;

writeFileSync(hook, content, "utf8");
if (process.platform !== "win32") chmodSync(hook, 0o755);
console.log(`Installed pre-commit hook at ${hook}`);
