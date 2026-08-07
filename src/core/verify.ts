import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Whole-change spec→source evidence pass (idea from a sibling spec-driven
 * toolkit, reimplemented in orion's own zero-dependency style; nothing
 * copied). For every acceptance-criterion bullet in a change's specs, extract
 * its distinctive terms and scan the project source for evidence, classifying
 * each one compliant / missing / drifted.
 *
 * This catches the hole the export-based drift can miss: a requirement
 * written in the spec but never implemented anywhere in the code — even when
 * every individual check passes. It is a deterministic *signal* (reported as
 * a list + summary), never a gate.
 */

export type VerifyStatus = "compliant" | "missing" | "drifted";

/** One acceptance criterion and how much source evidence backs it up. */
export interface CriterionFinding {
  /** Spec file path relative to `changes/<changeId>/specs/`. */
  spec: string;
  /** The criterion bullet text found after `- ` in the spec. */
  criterion: string;
  status: VerifyStatus;
  /** Distinctive terms extracted from the criterion. */
  terms: string[];
  /** How many of those terms have at least one source match. */
  matched: number;
  /** Source files that contained any of the terms (evidence). */
  evidence: string[];
}

/** Result of verifying one change's specs against the project source. */
export interface VerifyResult {
  changeId: string;
  findings: CriterionFinding[];
  missingCount: number;
  driftedCount: number;
  total: number;
}

/** Short noise words never treated as distinctive evidence terms. */
const STOPWORDS = new Set([
  "when", "then", "that", "with", "this", "from", "have", "must", "should",
  "shall", "will", "would", "could", "there", "their", "these", "those",
  "each", "into", "only", "also", "already", "after", "before", "about",
  "between", "through", "within", "during", "because", "against", "being",
  "been", "were", "been", "does", "doesn", "done", "over", "under", "more",
  "most", "less", "fewer", "same", "such", "other", "first", "second",
  "third", "not", "are", "was", "its", "has", "had", "and", "for", "all",
  "any", "may", "can", "new", "the", "and", "subject", "in", "of", "to",
  "is", "it", "as", "on", "by", "be", "or", "at", "an", "per", "zero",
  "one", "two", "three", "four", "five", "shouldn", "won't", "wouldn",
]);

/** Directories never scanned as source (they are not implementation). */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".orion"]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Deterministically list source files under a root (defensive). */
export function listSourceFiles(root: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(root, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) listSourceFiles(full, out);
    else if (SOURCE_EXT.test(name)) out.push(full);
  }
  return out;
}

/** Extract distinctive evidence terms from a criterion (>=4 chars, no stopwords). */
export function extractTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [];
  const seen = new Set<string>(); // de-duplicate, keep first occurrence order
  const terms: string[] = [];
  for (const w of words) {
    if (w.length < 4) continue;
    if (STOPWORDS.has(w)) continue;
    // A bare number/hyphen isn't evidence.
    if (/^[0-9-]+$/.test(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    terms.push(w);
  }
  return terms;
}

/** Whether a term appears as a word-boundary match in a source string. */
function termInSource(term: string, source: string): boolean {
  // Escape regex metachars inside term (terms may contain '-').
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(source);
}

function readCapped(file: string, maxBytes = 128 * 1024): string {
  try {
    const buf = readFileSync(file);
    return buf.subarray(0, maxBytes).toString("utf8");
  } catch {
    return "";
  }
}

/** Collect the spec.md paths under a change's specs/ directory. */
export function discoverySpecFiles(base: string): string[] {
  const specsDir = join(base, "specs");
  if (!existsSync(specsDir)) return [];
  const out: string[] = [];
  for (const dir of readdirSync(specsDir)) {
    const file = join(specsDir, dir, "spec.md");
    if (existsSync(file)) out.push(file);
  }
  return out;
}

/** Split a spec's acceptance criteria (bulleted lines under any heading). */
export function extractCriteria(specContent: string): string[] {
  const lines = specContent.replace(/^\uFEFF/, "").split(/\r?\n/);
  const criteria: string[] = [];
  // Only bullets under an "Acceptance criteria" / "Requirements" heading.
  let inCriteria = false;
  for (const line of lines) {
    if (/^#{1,6}\s*/i.test(line)) {
      inCriteria = /acceptance\s*criteria|requirement|scenario/i.test(line);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet && inCriteria) {
      // Strip a task-list checkbox marker (`- [ ] ` / `- [x] `).
      const text = bullet[1].replace(/^\[( |x|X)\]\s*/, "").trim();
      if (text) criteria.push(text);
    }
  }
  return criteria;
}

/** Run the whole-change evidence pass for a change against the project root. */
export function verifyChange(changeId: string, projectRoot = process.cwd()): VerifyResult {
  const base = join(projectRoot, "changes", changeId);
  if (!existsSync(base)) {
    throw new Error(
      `change "${changeId}" not found under changes/ — run "orion think ..." first`,
    );
  }
  const specFiles = discoverySpecFiles(base);
  const sources = listSourceFiles(join(projectRoot, "src")).map((f) => ({
    file: relative(projectRoot, f),
    source: readCapped(f),
  }));

  const findings: CriterionFinding[] = [];
  for (const specFile of specFiles) {
    const content = readCapped(specFile);
    const spec = relative(join(base, "specs"), specFile);
    for (const criterion of extractCriteria(content)) {
      const terms = extractTerms(criterion);
      if (terms.length < 2) {
        // Not enough distinctive signal — honest pass, never a false miss.
        findings.push({
          spec,
          criterion,
          status: "compliant",
          terms,
          matched: terms.length,
          evidence: [],
        });
        continue;
      }
      // A term is matched if ANY source file contains it.
      const matchedTerms = terms.filter((t) =>
        sources.some((s) => termInSource(t, s.source)),
      );
      const evidence = sources
        .filter((s) => matchedTerms.some((t) => termInSource(t, s.source)))
        .map((s) => s.file)
        .slice(0, 8);
      const status: VerifyStatus =
        matchedTerms.length === 0
          ? "missing"
          : matchedTerms.length < terms.length
            ? "drifted"
            : "compliant";
      findings.push({
        spec,
        criterion,
        status,
        terms,
        matched: matchedTerms.length,
        evidence,
      });
    }
  }

  return {
    changeId,
    findings,
    missingCount: findings.filter((f) => f.status === "missing").length,
    driftedCount: findings.filter((f) => f.status === "drifted").length,
    total: findings.length,
  };
}

/** Human-readable verify report. */
export function formatVerifyReport(res: VerifyResult): string {
  const lines = [
    `orion verify ${res.changeId}`,
    `spec scenarios/criteria: ${res.total} · missing: ${res.missingCount} · drifted: ${res.driftedCount}`,
    "",
  ];
  if (res.total === 0) {
    lines.push("(no acceptance criteria found — nothing to verify)");
    return lines.join("\n");
  }
  for (const f of res.findings) {
    const tag =
      f.status === "compliant"
        ? "ok    "
        : f.status === "missing"
          ? "MISS  "
          : "drift ";
    lines.push(
      `  ${tag} [${f.spec}] ${f.criterion.slice(0, 90)}` +
        (f.status === "missing"
          ? "  (no code evidence)"
          : `  (${f.matched}/${f.terms.length} terms${f.evidence[0] ? ` · ${f.evidence[0]}` : ""})`),
    );
  }
  if (res.missingCount > 0) {
    lines.push(
      "",
      "⚠️ " + res.missingCount + " criterion (not met) has no code evidence — spec may be unfulfilled despite passing checks.",
    );
  }
  return lines.join("\n");
}
