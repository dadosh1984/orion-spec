import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeFileSafe } from "../../utils/file.js";
import { formatBytes } from "../../utils/format.js";
import { OrionTrack } from "../../core/track.js";
import { compress } from "../../core/compress.js";
import { economyStats } from "../../core/compress.js";
import { recordLesson } from "../../core/lessons.js";
import { recordDebt, closeDebt } from "../../core/debt.js";
import type { GuardCheckResult, GuardReport } from "../../type.js";

const execAsync = promisify(exec);

type StepName = GuardCheckResult["step"];

/** Guard-rail steps in execution order. */
const STEPS: StepName[] = [
  "lint",
  "type",
  "test",
  "drift",
  "yagni",
  "economy",
  "security",
];

/**
 * `orion shield` — run every guard-rail against the change:
 * lint → type-check → unit tests → drift-check (code vs specs) → security scan.
 *
 * Context-driven (no flags):
 * - the package manager (pnpm/yarn/npm) is detected from the lockfile and
 *   the actual scripts from package.json — no hardcoded commands;
 * - a PASS is cached together with a hash of the project source, so any
 *   hand edit to src/ or the change invalidates the cache and the step
 *   is honestly re-run.
 */
export async function shield(
  changeId: string,
  opts?: { noCache?: boolean },
): Promise<GuardReport> {
  // Honesty first: a change that does not exist cannot be verified.
  // Fabricating a PASS for a missing id would be a lie — fail loudly.
  if (!existsSync(`changes/${changeId}`)) {
    throw new Error(
      `change "${changeId}" not found under changes/ — run "orion think ..." (or "orion draft <title>") first`,
    );
  }
  const track = OrionTrack.init();
  const checks: GuardCheckResult[] = [];
  // Test escape hatch: skip the (slow, recursive) shell steps so e2e runs
  // only the deterministic drift + security gates.
  const skipShell = process.env.ORION_SHIELD_SKIP_SHELL === "1";
  const hash = projectHash(changeId);

  for (const step of STEPS) {
    if (skipShell && (step === "lint" || step === "type" || step === "test")) {
      checks.push({
        step,
        status: "SKIP",
        detail: "ORION_SHIELD_SKIP_SHELL=1",
      });
      continue;
    }
    // Cache hits only when the code hash matches — edited code is re-checked.
    // The `economy` step is NEVER cache-cached: cache size is live state,
    // a cached verdict would present stale truth (v0.17).
    if (
      step !== "economy" &&
      !opts?.noCache &&
      track.loadString(`shield:${step}`) === `PASS:${hash}`
    ) {
      const hit = track.loadWithDate(`shield:${step}`);
      const since = hit?.storedAt
        ? ` since ${new Date(hit.storedAt).toISOString()}`
        : "";
      checks.push({
        step,
        status: "SKIP",
        detail: `cached PASS${since} (hash unchanged)`,
      });
      continue;
    }
    const result = await runStep(step, changeId);
    checks.push(result);
    // Debt sync (v0.18): yagni WARN -> open debt, PASS -> close it. Only
    // when yagni actually ran (cache hits SKIP above and mutate nothing).
    if (step === "yagni" && result.status !== "SKIP") {
      syncDebt(changeId);
    }
    if (result.status === "FAIL") {
      // Self-correction (v0.12): a failed guard-rail is a lesson, not a
      // secret. `next` will route back to `think` with a corrective task.
      recordLesson({
        changeId,
        step: "shield",
        error: (result.detail ?? result.step).slice(0, 240),
        cause: `guard-rail ${result.step} failed`,
        fix: `fix the ${result.step} check, then re-run orion shield ${changeId}`,
      });
    }
    if (result.status === "PASS" && !opts?.noCache && step !== "economy") {
      track.store(`shield:${step}`, `PASS:${hash}`);
    }
  }

  const report: GuardReport = {
    changeId,
    checks,
    allPass: checks.every((c) => c.status !== "FAIL"),
    generatedAt: new Date().toISOString(),
    // Snapshot of what was verified — lets `out`/`next` tell stale truth
    // from fresh truth instead of presenting old results as new.
    contextHash: hash,
  };

  const md = [
    `# Guard Report — ${changeId}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Step | Status | Detail |",
    "|------|--------|--------|",
    ...checks.map((c) => `| ${c.step} | ${c.status} | ${c.detail ?? ""} |`),
    "",
    `**Overall: ${report.allPass ? "PASS" : "FAIL"}**`,
    "",
  ].join("\n");

  await writeFileSafe(`reports/${changeId}/guard-report.md`, md);
  await writeFileSafe(
    `reports/${changeId}/guard-report.json`,
    JSON.stringify(report, null, 2),
  );
  return report;
}

/** Detect the package manager from the lockfile present in the project. */
export function detectPackageManager(): "pnpm" | "yarn" | "npm" {
  if (existsSync("pnpm-lock.yaml")) return "pnpm";
  if (existsSync("yarn.lock")) return "yarn";
  return "npm";
}

/** Whether package.json defines the given script. */
function hasScript(name: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, unknown>;
    };
    return typeof pkg.scripts?.[name] === "string";
  } catch {
    return false;
  }
}

/**
 * Shell command for a guard step, derived from the project context
 * (package manager + actual scripts). Returns null when the step has no
 * sensible command — the step is then SKIPPED with a clear reason.
 */
export function stepCommand(step: "lint" | "type" | "test"): string | null {
  const pm = detectPackageManager();
  const run = (name: string) =>
    pm === "npm" ? `npm run ${name}` : `${pm} run ${name}`;
  switch (step) {
    case "lint":
      return hasScript("lint") ? run("lint") : null;
    case "type":
      if (hasScript("typecheck")) return run("typecheck");
      if (hasScript("type-check")) return run("type-check");
      return `${pm} exec tsc --noEmit`;
    case "test":
      return hasScript("test")
        ? pm === "npm"
          ? "npm test"
          : `${pm} test`
        : null;
  }
}

/**
 * Pipeline outputs inside changes/<id> that must NOT invalidate the context
 * hash (v0.10). The pipeline regenerates these files itself — hashing them
 * would make every guard verdict permanently "stale" after the first
 * `out`/`forge`, which would be a lie.
 */
const CONTEXT_OUTPUTS = new Set([
  "result.md",
  "forge-report.md",
  "forge-report.json",
]);

/**
 * Stable hash of the project source + the change, used to validate the
 * shield cache: any hand edit invalidates the cached PASS. Pipeline outputs
 * (result.md, forge-report.*) are excluded so generated artifacts do not
 * poison the freshness check.
 */
export function projectHash(changeId: string): string {
  const h = createHash("sha1");
  const roots = ["src", "package.json", `changes/${changeId}`];
  const files: string[] = [];
  for (const root of roots) {
    if (root.endsWith(".json")) {
      if (existsSync(root)) files.push(root);
      continue;
    }
    files.push(
      ...walk(root).filter(
        (f) => f.endsWith(".ts") || f.endsWith(".md") || f.endsWith(".json"),
      ),
    );
  }
  for (const f of files.sort()) {
    // path.join uses backslashes on Windows — normalize before comparing.
    const normalized = f.replace(/\\/g, "/");
    if (normalized.startsWith(`changes/${changeId}/`)) {
      const base = normalized.split("/").pop()!;
      if (CONTEXT_OUTPUTS.has(base)) continue;
    }
    try {
      h.update(f);
      h.update(readFileSync(f, "utf8"));
    } catch {
      /* unreadable file — skip */
    }
  }
  return h.digest("hex").slice(0, 12);
}

/** Execute a single guard-rail step. */
async function runStep(
  step: StepName,
  changeId: string,
): Promise<GuardCheckResult> {
  switch (step) {
    case "lint": {
      const cmd = stepCommand("lint");
      return cmd
        ? shellCheck(step, cmd)
        : { step, status: "SKIP", detail: "no lint script in package.json" };
    }
    case "type": {
      const cmd = stepCommand("type");
      return cmd
        ? shellCheck(step, cmd)
        : { step, status: "SKIP", detail: "no typecheck script" };
    }
    case "test": {
      const cmd = stepCommand("test");
      return cmd
        ? shellCheck(step, cmd)
        : { step, status: "SKIP", detail: "no test script in package.json" };
    }
    case "drift":
      return driftCheck(changeId);
    case "yagni":
      return yagniCheck(changeId);
    case "economy":
      return economyCheck();
    case "security":
      return securityScan(changeId);
  }
}

/** Run an external command and map exit status to PASS/FAIL. Output is
 * compressed through the token-economy engine (v0.11): test runners show
 * failures + a count, linters/tsc show error lines only — the agent reads
 * the signal, not the noise.
 */
async function shellCheck(
  step: StepName,
  cmd: string,
): Promise<GuardCheckResult> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 300_000,
    });
    const r = compress(cmd, stdout, stderr);
    const detail =
      (r.matched ? r.out : (stdout + stderr).slice(0, 200)) || "ok";
    return {
      step,
      status: "PASS",
      detail: detail.slice(0, 500),
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "command failed";
    const r = compress(cmd, raw, "");
    const detail = r.matched ? r.out.slice(0, 500) : raw.slice(0, 200);
    return { step, status: "FAIL", detail };
  }
}

/**
 * Drift check: every capability named in the spec files under
 * `changes/<id>/specs/` must have a matching *exported symbol* in
 * `src/tasks/`. AST-free but honest: only real export declarations count
 * (comments and stray mentions no longer produce false positives).
 */
function driftCheck(changeId: string): GuardCheckResult {
  const specsDir = `changes/${changeId}/specs`;
  if (!existsSync(specsDir)) {
    return { step: "drift", status: "PASS", detail: "no specs to compare" };
  }
  const expected: string[] = [];
  for (const dir of readdirSync(specsDir)) {
    const specFile = join(specsDir, dir, "spec.md");
    if (!existsSync(specFile)) continue;
    const spec = readFileSync(specFile, "utf8");
    for (const m of spec.matchAll(/^# Spec: (.+)$/gm))
      expected.push(m[1].trim());
  }
  if (expected.length === 0) {
    return {
      step: "drift",
      status: "PASS",
      detail: "no capabilities in specs",
    };
  }

  const srcDir = "src/tasks";
  const exports = new Set<string>();
  if (existsSync(srcDir)) {
    for (const f of readdirSync(srcDir).filter((f) => f.endsWith(".ts"))) {
      collectExports(readFileSync(join(srcDir, f), "utf8"), exports);
    }
  }

  const missing = expected.filter((cap) => !exports.has(cap));
  return missing.length === 0
    ? {
        step: "drift",
        status: "PASS",
        detail: `matched ${expected.length} exported capabilities`,
      }
    : {
        step: "drift",
        status: "FAIL",
        detail: `missing exported: ${missing.join(", ")}`,
      };
}

/** Collect exported symbol names (declarations + export lists). */
function collectExports(source: string, out: Set<string>): void {
  const decl =
    /\bexport\s+(?:declare\s+)?(?:const|function|class|interface|type|enum|let|var)\s+([A-Za-z0-9_$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(source))) out.add(m[1]);
  const list = /\bexport\s*\{([^}]*)\}/g;
  while ((m = list.exec(source))) {
    for (const part of m[1].split(",")) {
      // string-named aliases (`export { x as "cap-name" }`) are real
      // exports too (v0.15) — drift specs may use dashed capability names
      const alias = part.trim().match(/as\s+"([^"]+)"\s*$/);
      if (alias) {
        out.add(alias[1]);
        continue;
      }
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name && /^[A-Za-z0-9_$]+$/.test(name)) out.add(name);
    }
  }
}

/**
 * YAGNI signal (v0.15) — deterministic, advisory, never a gate.
 * Snippets added by this change are measured against the repo's own code
 * norms (median LOC and import count of existing `.ts` sources). An outlier
 * (> 3× the median in either metric) is reported as WARN with an honest
 * per-file breakdown — a signal to reconsider scope, not a ban: `allPass`
 * only looks at FAIL, so a legitimately large snippet cannot silently
 * block the change.
 */
/**
 * YAGNI check: compare the change's new snippets against the repo median
 * (LOC and import count). Far-above-norm snippets produce a WARN — a
 * signal, never a gate (v0.15).
 */
export function yagniCheck(changeId: string): GuardCheckResult {
  const findings = yagniFindings(changeId);
  const { medianLoc, medianImports, snippets, warnings } = findings;
  if (medianLoc === null) {
    return {
      step: "yagni",
      status: "SKIP",
      detail: "no existing .ts sources to build a baseline from",
    };
  }
  if (snippets.length === 0) {
    return {
      step: "yagni",
      status: "PASS",
      detail: `no snippets to check (repo median: ${medianLoc} LOC, ${medianImports} imports)`,
    };
  }
  if (warnings.length > 0) {
    return {
      step: "yagni",
      status: "WARN",
      detail: `${warnings.length} snippet(s) far above repo norms (median ${medianLoc} LOC, ${medianImports} imports): ${warnings
        .map((w) => `${w.path}: ${w.reasons.join("; ")}`)
        .join(" | ")}`,
    };
  }
  return {
    step: "yagni",
    status: "PASS",
    detail: `${snippets.length} snippet(s) within repo norms (median ${medianLoc} LOC, ${medianImports} imports)`,
  };
}

export interface YagniSnippet {
  path: string;
  loc: number;
  imports: number;
  reasons: string[];
}

export interface YagniFindings {
  medianLoc: number | null;
  medianImports: number;
  snippets: YagniSnippet[];
  warnings: YagniSnippet[];
}

/**
 * Shared YAGNI computation (v0.18): repo median + per-snippet stats, so
 * `yagniCheck` and the debt registry (syncDebt) never drift apart.
 */
export function yagniFindings(changeId: string): YagniFindings {
  const repoFiles = walk("src").filter((f) => f.endsWith(".ts"));
  if (repoFiles.length === 0) {
    return {
      medianLoc: null,
      medianImports: 0,
      snippets: [],
      warnings: [],
    };
  }
  const locs: number[] = [];
  const importCounts: number[] = [];
  for (const f of repoFiles) {
    const code = readFileSync(f, "utf8");
    locs.push(code.split(/\r?\n/).filter((l) => l.trim().length > 0).length);
    const imports =
      (code.match(/\bimport\b[^;]*/g) ?? []).length +
      (code.match(/\brequire\s*\(/g) ?? []).length;
    importCounts.push(imports);
  }
  const medianLoc = median(locs);
  const medianImports = median(importCounts);

  const snippetsDir = `changes/${changeId}/snippets`;
  const snippets = existsSync(snippetsDir)
    ? walk(snippetsDir).filter((f) => f.endsWith(".ts"))
    : [];

  const stats: YagniSnippet[] = [];
  const warnings: YagniSnippet[] = [];
  for (const s of snippets) {
    const code = readFileSync(s, "utf8");
    const loc = code.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
    const imports =
      (code.match(/\bimport\b[^;]*/g) ?? []).length +
      (code.match(/\brequire\s*\(/g) ?? []).length;
    const reasons: string[] = [];
    if (medianLoc > 0 && loc > 3 * medianLoc) {
      reasons.push(
        `${loc} LOC vs median ${medianLoc} (${(loc / medianLoc).toFixed(1)}×)`,
      );
    }
    if (medianImports > 0 && imports > 3 * medianImports) {
      reasons.push(
        `${imports} imports vs median ${medianImports} (${(imports / medianImports).toFixed(1)}×)`,
      );
    }
    const row = { path: s, loc, imports, reasons };
    stats.push(row);
    if (reasons.length > 0) warnings.push(row);
  }
  return { medianLoc, medianImports, snippets: stats, warnings };
}

/**
 * Debt sync (v0.18): every yagni WARN becomes an open debt entry, every
 * snippet that no longer triggers the WARN closes its entry. Runs only
 * when yagni is actually executed (never on a cache hit), so a stale
 * signal can never fabricate a debt.
 */
export function syncDebt(changeId: string): void {
  const { medianLoc, warnings, snippets } = yagniFindings(changeId);
  if (medianLoc === null) return;
  const warned = new Set(warnings.map((w) => w.path));
  for (const s of snippets) {
    if (warned.has(s.path)) {
      recordDebt(s.path, s.loc, medianLoc);
    } else {
      closeDebt(s.path);
    }
  }
}

/** Median of a numeric array (middle element of a sorted copy). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Economy check (v0.17) — read-only, always fresh (never cache-cached).
 * The token-economy cache is measured against its own budget (track
 * config maxSize, default 100 MB): above 60% → WARN with honest numbers
 * and a prune hint — a signal, never a gate (only FAIL breaks allPass).
 * The detail also carries the ledger savings so the shield report shows
 * both sides of the economy: what the cache costs and what compress saved.
 */
export function economyCheck(): GuardCheckResult {
  const track = OrionTrack.init();
  const { maxSize } = track.config();
  const stats = track.getStats();
  const eco = economyStats();
  const budget = 0.6 * maxSize;
  const base = `cache ${formatBytes(stats.size)} of ${formatBytes(maxSize)} (${stats.count} entries)`;
  const ledger =
    eco.entries > 0
      ? `≈ ${eco.savedTokens} tok saved across ${eco.entries} compress op(s)`
      : "no compress ops recorded yet";
  if (stats.count === 0) {
    return {
      step: "economy",
      status: "PASS",
      detail: `cache is empty — ${ledger}`,
    };
  }
  if (stats.size > budget) {
    return {
      step: "economy",
      status: "WARN",
      detail: `${base} — above 60% of budget, consider orion track prune; ${ledger}`,
    };
  }
  return {
    step: "economy",
    status: "PASS",
    detail: `${base} — within budget; ${ledger}`,
  };
}

/**
 * Security scan: reject eval, new Function and raw process.env access in
 * the user's task code (`src/tasks`) and the change's own snippets. The
 * scanner deliberately does NOT scan the toolkit's own source.
 */
function securityScan(changeId: string): GuardCheckResult {
  const roots = ["src/tasks", `changes/${changeId}/snippets`].filter((p) =>
    existsSync(p),
  );
  if (roots.length === 0)
    return { step: "security", status: "PASS", detail: "no source to scan" };
  const findings: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [new RegExp("\\beval\\s*\\("), "eval()"],
    [new RegExp("\\bnew\\s+Function\\s*\\("), "new Function()"],
    [new RegExp("process\\.env\\."), "process.env.*"],
    [new RegExp("\\bchild_process\\b"), "child_process usage"],
    [
      new RegExp("(?:exec|execSync|spawnSync|spawn|fork)\\s*\\([^)]*\\$\\{"),
      "interpolated variable in shell exec",
    ],
    [
      new RegExp(
        "(?:exec|execSync|spawnSync)\\s*\\([^)]*[\"'`][^\"'`]*\\$\\s*\\(",
      ),
      "shell command substitution $(...) in exec",
    ],
    [
      new RegExp("(?:exec|execSync|spawnSync)\\s*\\([^)]*[|;&]"),
      "shell command chaining in exec",
    ],
    [
      new RegExp(
        "(?:require\\s*\\(\\s*[\"'](?:node:)?vm[\"']\\s*\\)|from\\s*[\"'](?:node:)?vm[\"'])",
      ),
      "node:vm sandbox escape risk",
    ],
    [
      new RegExp(
        "(?:api[_-]?key|secret|password|passwd|token)\\s*[:=]\\s*[\"'][^\"']{16,}",
        "i",
      ),
      "hardcoded credential",
    ],
    [
      new RegExp(
        "\\b(?:API[_-]?KEY|KEY|SECRET|PASSWORD|TOKEN)\\b\\s*[:=]\\s*[\"'][^\"']{16,}",
      ),
      "hardcoded credential (UPPERCASE)",
    ],
  ];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (!file.endsWith(".ts")) continue;
      const code = readFileSync(file, "utf8");
      for (const [re, label] of patterns) {
        if (re.test(code)) findings.push(`${file}: ${label}`);
      }
    }
  }
  return findings.length === 0
    ? { step: "security", status: "PASS", detail: "no obvious issues" }
    : {
        step: "security",
        status: "FAIL",
        detail: findings.slice(0, 5).join("; "),
      };
}

/** Recursively list files under a directory (resilient to broken entries). */
function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue; // broken symlink / permission error — skip
    }
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
