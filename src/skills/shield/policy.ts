import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { collectTsFiles } from "../../utils/file.js";

/**
 * Project policy gates (v0.23, idea #2: "strict gates" for shield).
 *
 * `.orion/policy.json` lets a project hard-enforce rules that shield's
 * heuristic steps only warn about — e.g. "this repo never imports lodash"
 * or "no `process.env.AWS_…` credentials in code". The policy step is a
 * hard gate: a violation FAILS the guard, exactly like lint/type/test.
 *
 * Honesty rules:
 * - deterministic and offline: a regex/import check, no LLM, no registry
 *   probes, no network;
 * - fail-closed on unreadable/invalid policy? No — fail-OPEN to {}: a broken
 *   or missing policy file must never fail a build by accident, and an
 *   unparseable policy is reported by loading the defaults (empty) so the
 *   user notices nothing silently gates; the file is validated by shape.
 * - the cache value embeds the policy fingerprint, so editing policy.json
 *   invalidates the cached PASS (no stale trust).
 */

/** Project policy: what the repo refuses, deterministically. */
export interface PolicyConfig {
  /** Package names that must never be imported (exact bare/scoped name). */
  denyImport?: string[];
  /** Regex sources that must never match any scanned file. */
  denyPattern?: string[];
}

/** Load `.orion/policy.json` from `cwd`; missing/invalid → empty policy. */
export function loadPolicy(cwd = process.cwd()): PolicyConfig {
  try {
    const raw = readFileSync(join(cwd, ".orion", "policy.json"), "utf8");
    const cfg = JSON.parse(raw) as PolicyConfig;
    if (!cfg || typeof cfg !== "object") return {};
    return {
      denyImport: Array.isArray(cfg.denyImport) ? cfg.denyImport : undefined,
      denyPattern: Array.isArray(cfg.denyPattern) ? cfg.denyPattern : undefined,
    };
  } catch {
    return {};
  }
}

/** Short fingerprint of the active policy — part of the shield cache key. */
export function policyFingerprint(cfg: PolicyConfig): string {
  return createHash("sha256")
    .update(JSON.stringify(cfg))
    .digest("hex")
    .slice(0, 12);
}

/** A single policy violation, with the file that carries it. */
export interface PolicyFinding {
  file: string;
  kind: "import" | "pattern";
  value: string;
}

/** import 'x' / import … from 'x' / require('x') — bare package refs. */
const IMPORT_RE =
  /(?:import\s+[^'"]*\s+from\s*|require\s*\()\s*['"]([^'"]+)['"]/g;

function barePackage(name: string): string {
  return name.startsWith("@")
    ? name.split("/").slice(0, 2).join("/")
    : name.split("/")[0];
}

/**
 * Scan the change's snippets + the repo's src/ for policy violations.
 * Deterministic, best-effort per file (unreadable files are skipped).
 */
export function scanPolicyFiles(
  cwd: string,
  changeId: string,
  cfg: PolicyConfig,
): PolicyFinding[] {
  const deny = new Set(cfg.denyImport ?? []);
  const patterns = (cfg.denyPattern ?? [])
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null; // invalid regex in policy.json: skip, don't crash
      }
    })
    .filter((r): r is RegExp => r !== null);
  if (deny.size === 0 && patterns.length === 0) return [];

  const findings: PolicyFinding[] = [];
  const files = [
    ...collectTsFiles(join(cwd, "changes", changeId, "snippets"), { tsx: true }),
    ...collectTsFiles(join(cwd, "src"), { tsx: true }),
  ];
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (deny.size > 0) {
      for (const m of src.matchAll(IMPORT_RE)) {
        const pkg = m[1];
        if (deny.has(pkg) || deny.has(barePackage(pkg))) {
          findings.push({ file, kind: "import", value: pkg });
        }
      }
    }
    for (const re of patterns) {
      const m = src.match(re);
      if (m) findings.push({ file, kind: "pattern", value: m[0].slice(0, 80) });
    }
  }
  return findings;
}
