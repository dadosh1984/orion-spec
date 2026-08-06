import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { writeFileSafe } from "../../utils/file.js";
import { OrionTrack } from "../../core/track.js";
import type { GuardCheckResult, GuardReport } from "../../type.js";

const execAsync = promisify(exec);

type StepName = GuardCheckResult["step"];

/** Guard-rail steps in execution order. */
const STEPS: StepName[] = ["lint", "type", "test", "drift", "security"];

/**
 * `orion shield` — run every guard-rail against the change:
 * lint → type-check → unit tests → drift-check (code vs specs) → security scan.
 * Each step result is cached as `shield:<step>` and skipped on repeat runs
 * (unless --no-cache is given).
 */
export async function shield(
  changeId: string,
  opts?: { noCache?: boolean },
): Promise<GuardReport> {
  const track = OrionTrack.init();
  const checks: GuardCheckResult[] = [];
  // Test escape hatch: skip the (slow, recursive) shell steps so e2e runs
  // only the deterministic drift + security gates.
  const skipShell = process.env.ORION_SHIELD_SKIP_SHELL === "1";

  for (const step of STEPS) {
    if (skipShell && (step === "lint" || step === "type" || step === "test")) {
      checks.push({
        step,
        status: "SKIP",
        detail: "ORION_SHIELD_SKIP_SHELL=1",
      });
      continue;
    }
    if (!opts?.noCache && track.loadString(`shield:${step}`) === "PASS") {
      checks.push({ step, status: "SKIP", detail: "cached PASS" });
      continue;
    }
    const result = await runStep(step, changeId);
    checks.push(result);
    if (result.status === "PASS" && !opts?.noCache) {
      track.store(`shield:${step}`, "PASS");
    }
  }

  const report: GuardReport = {
    changeId,
    checks,
    allPass: checks.every((c) => c.status !== "FAIL"),
    generatedAt: new Date().toISOString(),
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

/** Execute a single guard-rail step. */
async function runStep(
  step: StepName,
  changeId: string,
): Promise<GuardCheckResult> {
  switch (step) {
    case "lint":
      return shellCheck(step, "pnpm lint");
    case "type":
      return shellCheck(step, "pnpm exec tsc --noEmit");
    case "test":
      return shellCheck(step, "pnpm test");
    case "drift":
      return driftCheck(changeId);
    case "security":
      return securityScan(changeId);
  }
}

/** Run an external command and map exit status to PASS/FAIL. */
async function shellCheck(
  step: StepName,
  cmd: string,
): Promise<GuardCheckResult> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 300_000,
    });
    return {
      step,
      status: "PASS",
      detail: (stdout + stderr).slice(0, 200) || "ok",
    };
  } catch (err) {
    const detail =
      err instanceof Error ? err.message.slice(0, 200) : "command failed";
    return { step, status: "FAIL", detail };
  }
}

/**
 * Drift check: every capability named in the spec files under
 * `changes/<id>/specs/` must have a matching exported symbol in
 * `src/tasks/`. Best-effort AST-free comparison via exported names.
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
  const sources = existsSync(srcDir)
    ? readdirSync(srcDir)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => readFileSync(join(srcDir, f), "utf8"))
        .join("\n")
    : "";

  const missing = expected.filter((cap) => !sources.includes(cap));
  return missing.length === 0
    ? {
        step: "drift",
        status: "PASS",
        detail: `matched ${expected.length} capabilities`,
      }
    : {
        step: "drift",
        status: "FAIL",
        detail: `missing: ${missing.join(", ")}`,
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
