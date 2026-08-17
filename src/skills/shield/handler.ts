import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeFileSafe } from "../../utils/file.js";
import { humanBytes } from "../../utils/format.js";
import { OrionTrack } from "../../core/track.js";
import { compress } from "../../core/compress.js";
import { economyStats } from "../../core/compress.js";
import { recordLesson } from "../../core/lessons.js";
import { recordDebt, closeDebt } from "../../core/debt.js";
import { assessVerifiability } from "../../core/verifiability.js";
import { loadPolicy, policyFingerprint, scanPolicyFiles } from "./policy.js";
import {
  registerAdapter,
  getAdapters,
  detectAdapter,
} from "../../core/shield/adapter.js";
import { type ShieldAdapter } from "../../core/shield/adapter.js";
import { TypeScriptAdapter } from "../../core/shield/typescript.js";
import { loadShieldConfig } from "../../core/shield/config.js";
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
  "policy",
  "verifiability",
];

/**
 * Initialize adapters. Registers TypeScript adapter first (backward compat).
 */
export function initAdapters(): void {
  if (getAdapters().length === 0) {
    registerAdapter(TypeScriptAdapter);
  }
}

/** Resolve the active adapter for the project at cwd */
export function resolveAdapter(cwd = process.cwd()): ShieldAdapter | null {
  initAdapters();
  const config = loadShieldConfig(cwd);
  if (config?.language) {
    const match = getAdapters().find((a) => a.id === config.language);
    if (match) return match;
  }
  return detectAdapter(cwd) ?? TypeScriptAdapter; // fallback to TS
}

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
  opts?: {
    noCache?: boolean;
    /** MCP progress (v0.22): (step, index, total) after each guard-rail. */
    onProgress?: (step: string, index: number, total: number) => void;
  },
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
  const adapter = resolveAdapter();

  for (const step of STEPS) {
    // The policy gate's cache key embeds the policy fingerprint: editing
    // .orion/policy.json must invalidate a cached PASS (v0.23).
    const stepHash =
      step === "policy" ? `${hash}:${policyFingerprint(loadPolicy())}` : hash;
    opts?.onProgress?.(step, STEPS.indexOf(step) + 1, STEPS.length);
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
      track.loadString(`shield:${step}`) === `PASS:${stepHash}`
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
    const result = await runStep(step, changeId, adapter);
    // Honesty about a test PASS on weak tests (verifiability-aware): a
    // passing test step with no real assertions is marked `weak` — it cannot
    // fully support a strong verdict.
    if (step === "test" && result.status === "PASS") {
      const { testsMeaningful } = assessVerifiability();
      if (!testsMeaningful) result.weak = true;
    }
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
      track.store(`shield:${step}`, `PASS:${stepHash}`);
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
    ...(checks.some((c) => c.step === "verifiability" && c.status === "WARN")
      ? [
          "",
          "> ⚠️ lower-confidence PASS: this repo has weak/no verification oracles — treat as human-review needed.",
        ]
      : []),
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
  "receipt.json",
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
  adapter: ShieldAdapter | null = null,
): Promise<GuardCheckResult> {
  switch (step) {
    case "lint": {
      const gc = adapter?.getLintCommand();
      if (!gc) {
        const cmd = stepCommand("lint");
        return cmd
          ? shellCheck(step, cmd)
          : { step, status: "SKIP", detail: "no lint configured" };
      }
      return shellCheck(step, `${gc.cmd} ${gc.args.join(" ")}`, gc.parser);
    }
    case "type": {
      const gc = adapter?.getTypeCheckCommand();
      if (!gc) {
        const cmd = stepCommand("type");
        return cmd
          ? shellCheck(step, cmd)
          : { step, status: "SKIP", detail: "no typecheck configured" };
      }
      return shellCheck(step, `${gc.cmd} ${gc.args.join(" ")}`, gc.parser);
    }
    case "test": {
      const gc = adapter?.getTestCommand();
      if (!gc) {
        const cmd = stepCommand("test");
        return cmd
          ? shellCheck(step, cmd)
          : { step, status: "SKIP", detail: "no test configured" };
      }
      return shellCheck(step, `${gc.cmd} ${gc.args.join(" ")}`, gc.parser);
    }
    case "drift":
      return driftCheck(changeId, adapter);
    case "yagni":
      return yagniCheck(changeId);
    case "economy":
      return economyCheck();
    case "security":
      return securityScan(changeId, adapter);
    case "policy": {
      const cfg = loadPolicy();
      const findings = scanPolicyFiles(process.cwd(), changeId, cfg);
      if (findings.length === 0)
        return {
          step: "policy",
          status: "PASS",
          detail:
            Object.keys(cfg).length === 0
              ? "no .orion/policy.json — no project gates to enforce"
              : "no policy violations",
        };
      return {
        step: "policy",
        status: "FAIL",
        detail: `policy violation: ${findings
          .slice(0, 5)
          .map((f) => `${f.file} (${f.kind}: ${f.value})`)
          .join("; ")}`,
      };
    }
    case "verifiability":
      return verifiabilityCheck();
  }
}

/**
 * Verifiability step (idea from a sibling toolkit, reimplemented in orion's
 * own style): deterministically probe the repo and honestly label how much an
 * automated PASS is worth. WARN, never a gate.
 */
export function verifiabilityCheck(): GuardCheckResult {
  const v = assessVerifiability();
  const ora = v.oracles.length ? v.oracles.join(", ") : "none";
  const weak = v.testsMeaningful ? "" : " · tests weak/missing";
  const base = "oracles: " + ora + " · verifiability level " + v.level + weak;
  if (v.oracles.includes("test-runner") && !v.testsMeaningful) {
    return {
      step: "verifiability",
      status: "WARN",
      detail:
        base + " — a test PASS here is lower-confidence (no real assertions)",
    };
  }
  if (v.level <= 1) {
    return {
      step: "verifiability",
      status: "WARN",
      detail:
        base +
        " — low verifiability: treat this PASS as lower-confidence (human review advised)",
    };
  }
  return {
    step: "verifiability",
    status: "PASS",
    detail: base + " — strong checks present",
  };
}

/**
 * Strip Orion's own stderr chatter (🧠 lesson markers, ⚙/✅/❌ tool
 * announcements) from captured child output (v0.25) — the guard report
 * must show the command's signal, not the toolkit's own noise. The
 * lesson/announce lines are real events, but they are not test output.
 */
function stripOrionNoise(output: string): string {
  return output
    .split("\n")
    .filter(
      (l) =>
        !/^[🧠⚙✅❌]\s*orion[:\s]/.test(l) &&
        !/^\s*[✓·]\s*\[(assumption|fact|risk|decision)\]/.test(l) &&
        !/^forge (paused|complete|starting)/.test(l),
    )
    .join("\n");
}

/** Run an external command and map exit status to PASS/FAIL. Output is
 * compressed through the token-economy engine (v0.11): test runners show
 * failures + a count, linters/tsc show error lines only — the agent reads
 * the signal, not the noise.
 */
async function shellCheck(
  step: StepName,
  cmd: string,
  parser?: (stdout: string) => { status: "PASS" | "FAIL"; detail: string },
): Promise<GuardCheckResult> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 300_000,
    });
    // Use custom parser if provided
    if (parser) {
      return { step, ...parser(stdout) };
    }
    const clean = stripOrionNoise(stdout + stderr);
    const r = compress(cmd, clean, "");
    const detail = (r.matched ? r.out : clean.slice(0, 200)) || "ok";
    return {
      step,
      status: "PASS",
      detail: detail.slice(0, 500),
    };
  } catch (err) {
    // Use parser on error output if available
    if (parser && err instanceof Error) {
      return { step, ...parser(err.message) };
    }
    const raw = stripOrionNoise(
      err instanceof Error ? err.message : "command failed",
    );
    const r = compress(cmd, raw, "");
    const detail = r.matched ? r.out.slice(0, 500) : raw.slice(0, 200);
    return { step, status: "FAIL", detail };
  }
}

/** A valid JS identifier — what a `# Spec:` capability heading must be. */
const CAPABILITY_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Drift check: every capability named in the spec files under
 * `changes/<id>/specs/` must have a matching *exported symbol* in
 * `src/tasks/`. AST-free but honest: only real export declarations count
 * (comments and stray mentions no longer produce false positives).
 *
 * v0.24.2: a heading that is not a valid JS identifier is reported with a
 * rename hint instead of an unsatisfiable "missing exported" — a name like
 * `read-only-mypy-...` can never be exported, so the spec (not the code)
 * is what needs fixing.
 */
function driftCheck(
  changeId: string,
  adapter: ShieldAdapter | null = null,
): GuardCheckResult {
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

  const invalid = expected.filter((cap) => !CAPABILITY_IDENT.test(cap));
  if (invalid.length > 0) {
    return {
      step: "drift",
      status: "FAIL",
      detail:
        `invalid capability name(s): ${invalid.join(", ")} — ` +
        `"# Spec:" headings must be valid JS identifiers matching an ` +
        `export in src (rename the heading to the exported module's ` +
        `name, e.g. "# Spec: renderTasksBody")`, //
    };
  }

  // Use adapter's extractApi if available, else fallback to TS-only
  const srcDir = "src";
  const exports = new Set<string>();
  if (existsSync(srcDir) && adapter) {
    // Collect source files matching adapter's language
    const ext = adapter.id === "python" ? ".py" : ".ts";
    const files: string[] = [];
    const walkDir = (dir: string): void => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) walkDir(p);
        else if (ent.name.endsWith(ext)) files.push(p);
      }
    };
    walkDir(srcDir);
    for (const sym of adapter.extractApi(files)) exports.add(sym);
  } else if (existsSync(srcDir)) {
    // Fallback: original TS-only logic
    const walk = (dir: string): void => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith(".ts"))
          collectExports(readFileSync(p, "utf8"), exports);
      }
    };
    walk(srcDir);
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
  const base = `cache ${humanBytes(stats.size)} of ${humanBytes(maxSize)} (${stats.count} entries)`;
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

/** A [start, end) byte range of a comment or string/template literal. */
export interface LiteralRange {
  start: number;
  end: number;
  /** "comment" or "string"; the scanner filters by kind per pattern. */
  kind: "comment" | "string";
}

/**
 * Hand-rolled, dependency-free tokenizer returning the byte range of every
 * comment and string/template literal in a source file. The security scanner
 * uses it to ignore matches that BEGIN inside a literal: a comment is never
 * executed and a string is data, not code, so `// eval(` or `const s =
 * "eval("` cannot trigger a finding (kernel of the AST proposal — no parser
 * dependency). String payloads that ARE the signal (node:vm imports,
 * credential values, child_process usage via its import path) are still
 * seen: those matches start on code tokens (`require`, `from`, the key name)
 * or are exempted per pattern.
 */
export function literalRanges(code: string): LiteralRange[] {
  const ranges: LiteralRange[] = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") {
      const start = i;
      while (i < n && code[i] !== "\n") i++;
      ranges.push({ start, end: i, kind: "comment" });
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i = Math.min(n, i + 2);
      ranges.push({ start, end: i, kind: "comment" });
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const start = i;
      i++;
      while (i < n) {
        if (code[i] === "\\") {
          i += 2;
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      ranges.push({ start, end: i, kind: "string" });
      continue;
    }
    // RegExp literal /pattern/flags — not // or /*
    if (
      c === "/" &&
      code[i + 1] !== "/" &&
      code[i + 1] !== "*" &&
      // Previous char must NOT be alphanumeric, _ $ ) ] } — heuristic
      (i === 0 ||
        /[^a-zA-Z0-9_$)\]}]/.test(code[i - 1]))
    ) {
      const start = i;
      i++;
      let escaped = false;
      while (i < n) {
        if (code[i] === "\\" && !escaped) {
          escaped = true;
          i++;
          continue;
        }
        if (code[i] === "/" && !escaped) {
          i++;
          break;
        }
        escaped = false;
        i++;
      }
      // Consume optional flags
      while (i < n && /[dgimsuvy]/.test(code[i])) i++;
      ranges.push({ start, end: i, kind: "string" });
      continue;
    }
    i++;
  }
  return ranges;
}

/** True when a match at `index` starts inside a literal of the given kinds. */
function startsInLiteral(
  ranges: LiteralRange[],
  index: number,
  kinds: ReadonlyArray<LiteralRange["kind"]>,
): boolean {
  return ranges.some(
    (r) => index >= r.start && index < r.end && kinds.includes(r.kind),
  );
}

/**
 * Security scan: reject eval, new Function and raw process.env access in
 * the user's task code (`src/tasks`) and the change's own snippets. The
 * scanner deliberately does NOT scan the toolkit's own source. Matches that
 * begin inside a comment or string literal are ignored (see literalRanges)
 * — a heuristic barrier, honestly labeled, never a sandbox.
 */
function securityScan(
  changeId: string,
  adapter: ShieldAdapter | null = null,
): GuardCheckResult {
  const roots = ["src/tasks", `changes/${changeId}/snippets`].filter((p) =>
    existsSync(p),
  );
  if (roots.length === 0)
    return { step: "security", status: "PASS", detail: "no source to scan" };
  const findings: string[] = [];
  // Use adapter patterns if available, else default TS patterns
  const adapterPatterns = adapter?.getSecurityPatterns();
  const patterns: Array<[RegExp, string]> = adapterPatterns
    ? adapterPatterns.map((p) => [p.re, p.label])
    : [
        [new RegExp("\\beval\\s*\\("), "eval()"],
        [new RegExp("\\bnew\\s+Function\\s*\\("), "new Function()"],
        [new RegExp("process\\.env\\."), "process.env.*"],
        [new RegExp("\\bchild_process\\b"), "child_process usage"],
        [
          new RegExp(
            "(?:exec|execSync|spawnSync|spawn|fork)\\s*\\([^)]*\\$\\{",
          ),
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
      const scanExt = adapter?.id === "python" ? ".py" : ".ts";
      if (!file.endsWith(scanExt)) continue;
      const code = readFileSync(file, "utf8");
      const literals = literalRanges(code);
      for (const [re, label] of patterns) {
        // `child_process` is only ever seen via its import string, so that
        // pattern must still see string payloads (comments are filtered for
        // every pattern). Pure code tokens (eval, new Function,
        // process.env) also ignore strings — a string is data, not code.
        const kinds: LiteralRange["kind"][] =
          label === "child_process usage" ? ["comment"] : ["comment", "string"];
        // Fresh global copy per (file × pattern): a shared non-global regex
        // cannot iterate all matches (lastIndex would be shared/mutated).
        const rx = new RegExp(
          re.source,
          re.flags.includes("g") ? re.flags : `${re.flags}g`,
        );
        let m: RegExpExecArray | null;
        while ((m = rx.exec(code)) !== null) {
          if (startsInLiteral(literals, m.index, kinds)) continue;
          // v0.25: Orion's own configuration toggles (ORION_*) are not
          // hazards — only non-ORION env access is flagged. Reading
          // ORION_LESSON_NOTIFY is a feature, not an escape attempt.
          if (label === "process.env.*") {
            const rest = code.slice(m.index + "process.env.".length);
            const name = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0] ?? "";
            if (name.startsWith("ORION_")) continue;
          }
          findings.push(`${file}: ${label}`);
          break; // one finding per pattern per file, as before
        }
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
