/**
 * Prompt drift guard (v0.22, idea #10 from the observability review).
 *
 * `think` turns raw prompts into proposals; a hallucinated dependency
 * ("super-xml-parser-2026") would honestly be chased into RED and recorded
 * as a lesson — a token-burning detour. This module flags the cheap,
 * deterministic drift signals BEFORE the proposal exists:
 *
 * 1. future-dated library-like tokens (a name carrying a year is the classic
 *    hallucination tell);
 * 2. package-looking references (`require('x')`, `from 'x'`) that can be
 *    probed against the npm registry — best-effort and OPT-IN, because a
 *    network round-trip must never gate an offline workflow;
 * 3. placeholder/filler markers (TBD, "something like …") that would flow
 *    straight into a spec.
 *
 * Honesty rules:
 * - offline by default; the registry probe fails OPEN (network error ⇒
 *   "unknown", never a hard miss);
 * - the guard is a confirmation gate, not a censor: `think --force` records
 *   the user's explicit choice to proceed;
 * - deterministic, zero dependencies (global `fetch` is built into Node 22).
 */

/** A package name extracted from a prompt (bare name, no scope/quotes). */
export interface PackageCandidate {
  name: string;
  /** Where it appeared — for the report. */
  context: string;
}

export interface GuardVerdict {
  ok: boolean;
  /** Human-readable issues; empty when the prompt is clean. */
  issues: string[];
  /** Package-like references found (input for the opt-in registry probe). */
  packages: PackageCandidate[];
}

/** A name like `*-2026` / `*-2031` — the classic hallucinated-package tell. */
const YEAR_TOKEN =
  /\b[a-z][a-z0-9_-]*?(?:19\d{2}|20\d{2}|2[0-9]{3})[a-z0-9_-]*\b/gi;

/** require('x') / import … from 'x' / import 'x' references. */
const PACKAGE_REF =
  /(?:require\s*\(\s*|from\s+|import\s+)(?:["'])([a-z0-9@][a-z0-9_./@-]*)(?:["'])/gi;

/** Placeholder markers that would flow straight into a spec. */
const PLACEHOLDER = /\b(tbd|todo|placeholder|something like|etc\.?)\b/gi;

/** A relative/local path inside a require/from is not a package. */
function isLocalPath(name: string): boolean {
  return (
    name.startsWith(".") ||
    name.startsWith("node:") ||
    name.startsWith("/") ||
    name.startsWith("\\") ||
    /\.(json|js|ts|mjs|cjs)$/.test(name)
  );
}

/**
 * Offline drift scan. Deterministic, cheap, never throws.
 */
export function guardPrompt(prompt: string): GuardVerdict {
  const issues: string[] = [];
  const packages: PackageCandidate[] = [];

  const years = prompt.match(YEAR_TOKEN) ?? [];
  for (const tok of years) {
    issues.push(
      `prompt references "${tok}" — a name carrying a year is the classic ` +
        "hallucinated-package tell; confirm it really exists before building",
    );
  }

  for (const m of prompt.matchAll(PACKAGE_REF)) {
    const name = m[1];
    if (isLocalPath(name)) continue;
    if (years.some((y) => y === name)) continue; // already flagged above
    packages.push({ name, context: m[0] });
  }
  // Bare backtick/quoted single words that look like packages are too noisy
  // to flag on their own — only require/import references count as probes.

  const placeholders = prompt.match(PLACEHOLDER) ?? [];
  for (const ph of placeholders) {
    issues.push(
      `prompt contains placeholder "${ph}" — a TBD will flow straight into ` +
        "the spec; replace it with the real requirement",
    );
  }

  return { ok: issues.length === 0, issues, packages };
}

/**
 * Best-effort registry probe (OPT-IN; fail-open). Returns a map of
 * name → "exists" | "missing" (HTTP 404) | "unknown" (network error, timeout,
 * non-404). Scoped packages use the unscoped base for the HTTP check but the
 * scoped name in the verdict.
 */
export async function checkNpmPackages(
  names: string[],
  timeoutMs = 3000,
): Promise<Record<string, "exists" | "missing" | "unknown">> {
  const out: Record<string, "exists" | "missing" | "unknown"> = {};
  const unique = [...new Set(names)];
  for (const name of unique) {
    const bare = name.startsWith("@") ? name.split("/")[0] : name;
    const probeName = name.startsWith("@") ? name : bare;
    const url = `https://registry.npmjs.org/${encodeURIComponent(probeName)}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "HEAD", signal: ac.signal });
      out[name] = res.status === 404 ? "missing" : "exists";
    } catch {
      out[name] = "unknown"; // offline/timeout: fail open, never hard-miss
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
