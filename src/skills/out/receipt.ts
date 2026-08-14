/**
 * Honest Receipt (v0.52, task 2.3) — the visual certificate of quality.
 *
 * NOT an "AI says 100% coverage" claim. Every field either comes from the
 * real shield report, or honestly says "not measured". The principle is
 * unchanged (v0.10): never fabricate a number. If coverage was not run, we
 * write "not measured", never "100%".
 *
 * Fields (minimum honest set for v1):
 *   change, ts, spec↔source (drift), tests (passed/skipped), coverage,
 *   hazards, sha256 (reproducible hash of the change's artifacts).
 *
 * v2 (deliberately not in v1): lessons, runtime cost, replay cost, SVG badge.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { GuardReport, GuardCheckResult } from "../../type.js";

export interface ReceiptData {
  change: string;
  ts: string;
  specSource: string;
  tests: string;
  coverage: string;
  hazards: string;
  sha256: string;
  /** Honest machine-readable verdict (v2.4): verified | partial | failing. */
  status: "verified" | "partial" | "failing";
}
function check(
  guard: GuardReport | null,
  step: string,
): GuardCheckResult | undefined {
  return guard?.checks.find((c) => c.step === step);
}

/**
 * A stable timestamp for the receipt: prefer the guard's generatedAt (fixed
 * once shield ran); without a guard, use the newest artifact mtime so the
 * receipt does not change between two `out` runs (idempotency). RESULT.md and
 * receipt.json are OUTPUTS — excluded so writing them does not bump the ts
 * and make `out` non-reproducible. Never `now`.
 */
function receiptTs(changeId: string, guard: GuardReport | null): string {
  if (guard?.generatedAt) return guard.generatedAt;
  const dir = `changes/${changeId}`;
  if (!existsSync(dir)) return new Date(0).toISOString();
  let max = 0;
  const walk = (base: string): void => {
    if (!existsSync(base)) return;
    const st = statSync(base);
    if (st.isFile()) {
      const name = base.split(/[\\/]/).pop() ?? "";
      if (name === "result.md" || name === "receipt.json") return; // outputs
      max = Math.max(max, st.mtimeMs);
    } else if (st.isDirectory())
      for (const e of readdirSync(base)) walk(join(base, e));
  };
  walk(dir);
  return new Date(max || 0).toISOString();
}

/** Parse "Tests  785 passed | 2 skipped (787)" → { passed, skipped, total }. */
function parseTests(detail: string | undefined): string {
  if (!detail) return "not measured";
  const m = detail.match(
    /Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+skipped\s*\((\d+)\)/,
  );
  if (m) return `${m[1]} passing, ${m[2]} skipped`;
  // Detail exists but the Tests summary line is absent — be explicit.
  return "ran (no pass/skip summary)";
}

/** Drift: the gate re-checks spec headings against exported src symbols. */
function parseSpecSource(changeId: string, guard: GuardReport | null): string {
  // Count spec headings deterministically (the same thing drift checks).
  let expected = 0;
  const specsDir = `changes/${changeId}/specs`;
  if (existsSync(specsDir)) {
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "spec.md") {
          const txt = readFileSync(p, "utf8");
          expected += (txt.match(/^# Spec: (.+)$/gm) ?? []).length;
        }
      }
    };
    walk(specsDir);
  }
  const drift = check(guard, "drift");
  const detail = drift?.detail ?? "";
  const matched = detail.match(/matched (\d+)/);
  if (matched) {
    const m = Number(matched[1]);
    return expected > 0
      ? `${m}/${expected} symbols matched`
      : `${m} exported capability(ies) matched`;
  }
  if (drift?.status === "PASS" && expected === 0)
    return "no specs — nothing to verify";
  return "not measured";
}

/** Security hazards: the scan either found none ("no obvious issues") or a count. */
function parseHazards(guard: GuardReport | null): string {
  const sec = check(guard, "security");
  if (sec?.status === "PASS" && /no obvious issues/i.test(sec.detail ?? "")) {
    return "0 destructive patterns";
  }
  if (sec && sec.detail) return sec.detail.trim().slice(0, 80);
  return sec ? "0 (scan passed)" : "not measured";
}

/** Coverage: only if coverage/coverage-final.json actually exists. Else "not measured". */
function readCoverage(): string {
  const path = "coverage/coverage-final.json";
  if (!existsSync(path)) return "not measured";
  try {
    const cov = JSON.parse(readFileSync(path, "utf8")) as Record<
      string,
      { lines?: { percent: number }; branches?: { percent: number } }
    >;
    let linesTotal = 0;
    let branchesTotal = 0;
    let n = 0;
    for (const v of Object.values(cov)) {
      if (v && typeof v === "object" && "lines" in (v as object)) {
        linesTotal += v.lines?.percent ?? 0;
        branchesTotal += v.branches?.percent ?? 0;
        n++;
      }
    }
    if (n === 0) return "0% (no files with metrics)";
    return `${Math.round(linesTotal / n)}% lines (${Math.round(branchesTotal / n)}% branches)`;
  } catch {
    return "coverage file present but unreadable — not measured";
  }
}

/** Reproducible hash of spec files + tasks.md + snippet source. */
export function computeReproHash(changeId: string): string {
  const hash = createHash("sha256");
  const dir = `changes/${changeId}`;
  const known = ["specs", "tasks.md", "design.md", "proposal.json", "snippets"];
  const walk = (base: string): void => {
    if (!existsSync(base)) return;
    const st = statSync(base);
    if (st.isFile()) {
      hash.update(base + "\n");
      hash.update(readFileSync(base).toString("base64"));
    } else if (st.isDirectory()) {
      for (const e of readdirSync(base).sort()) walk(join(base, e));
    }
  };
  for (const k of known) walk(join(dir, k));
  return hash.digest("hex").slice(0, 12);
}

/**
 * Derive a deterministic, honest status from a guard report.
 *
 * - ANY FAIL check → "failing" (never a green badge on a red guard).
 * - allPass but coverage "not measured" (or anything honestly unmeasured) →
 *   "partial" (the badge must not claim full verification it cannot prove).
 * - everything clean AND measured → "verified".
 * A null guard (no shield run) stays "failing"/default — never "verified".
 */
export function deriveStatus(guard: GuardReport | null): ReceiptData["status"] {
  if (!guard) return "failing"; // no guard out→ no verified claim
  if (!guard.allPass) return "failing";
  if (readCoverage() === "not measured") return "partial";
  return "verified";
}

/**
 * Build the Honest Receipt from the guard report + the change's real data.
 * Every field is either measured or honestly "not measured".
 */
export function buildReceipt(
  changeId: string,
  guard: GuardReport | null,
): ReceiptData {
  return {
    change: changeId,
    ts: receiptTs(changeId, guard),
    specSource: parseSpecSource(changeId, guard),
    tests: parseTests(check(guard, "test")?.detail),
    coverage: readCoverage(),
    hazards: parseHazards(guard),
    sha256: computeReproHash(changeId),
    status: deriveStatus(guard),
  };
}

/** Render the receipt as the ASCII box (text block for result.md). */
export function renderReceiptText(r: ReceiptData): string {
  const row = (k: string, v: string): string => `│ ${k.padEnd(14)} ${v}`;
  const pad = 50;
  return [
    "╭─ Honest Receipt ──────────────────────╮",
    row("change:", r.change).slice(0, pad),
    row("ts:", r.ts).slice(0, pad),
    row("spec ↔ source:", r.specSource).slice(0, pad),
    row("tests:", r.tests).slice(0, pad),
    row("coverage:", r.coverage).slice(0, pad),
    row("hazards:", r.hazards).slice(0, pad),
    row("sha256:", r.sha256).slice(0, pad),
    "╰───────────────────────────────────────╯",
  ].join("\n");
}

/** Render the receipt as JSON (machine-readable). */
export function receiptJson(r: ReceiptData): string {
  return JSON.stringify(r, null, 2);
}
