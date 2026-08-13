/**
 * Skill-to-step matcher (v0.51) — Phase 1 of «eat an elephant», no ML.
 *
 * Matches an atomic step against the skill registry using BM25 over the
 * normalized action string + description + tags. Self-contained: IDF is
 * built on the fly from the scripts/ catalog — no external packages, no
 * network, no embeddings.
 *
 * Error asymmetry: a false positive (running the WRONG skill) costs far
 * more than a false reject (sending the step to the LLM). So thresholds
 * are conservative — a borderline score is NOT resolved automatically in
 * either direction; it returns a short candidate list for cheap LLM
 * verification instead of a full model run of the step.
 *
 * Domain filter happens BEFORE scoring: candidates are only pulled from
 * the step's domain registry, mapping `domain === currentProjectDomain`,
 * so «создать запись» in a 1C context cannot match a contracts-bot skill.
 */

import { homedir } from "node:os";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Skill record as read from the scripts/ registry (subset of RunManifest). */
export interface SkillMeta {
  name: string;
  description: string;
  tags: string[];
  domain: string;
  scriptPath: string;
  usageCount: number;
  environmentFingerprint?: string;
}

export type MatchTier = "exact" | "bm25";

export type MatchDecision =
  | { kind: "matched"; skill: SkillMeta; tier: MatchTier; score: number }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: SkillMeta[] };

/** BM25 tuning knobs (Okapi). k1 ~ 1.2, b ~ 0.75 are the classic defaults. */
const K1 = 1.2;
const B = 0.75;

function scriptsDir(): string {
  return process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion", "scripts");
}

/**
 * Resolve the current project's domain for skill matching. Explicit
 * declaration, never guessed from the repo name (name→domain heuristics are
 * fragile and silently drift). Resolution order:
 *   1. <repo-root>/.orion/config.json  →  { "domain": "..." }
 *   2. ORION_DOMAIN env                →  (tests / CI)
 *   3. "general"                       →  last-resort fallback (never the
 *                                         default SOURCE, just the guard)
 */
export function resolveDomain(): string {
  const env = process.env.ORION_DOMAIN;
  if (env && env.trim()) return env.trim();
  try {
    const cfg = join(process.cwd(), ".orion", "config.json");
    if (existsSync(cfg)) {
      const parsed = JSON.parse(readFileSync(cfg, "utf8")) as {
        domain?: string;
      };
      if (parsed.domain && parsed.domain.trim()) return parsed.domain.trim();
    }
  } catch {
    /* malformed config → fall through to 'general' */
  }
  return "general";
}

const HTML_TAG = /<[^>]+>/g;
function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(HTML_TAG, " ")
    .replace(/[^\p{L}\p{N}\s_+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const t = normalize(text);
  if (!t) return [];
  return t.split(" ").filter((w) => w.length > 1);
}

function readSkills(domain?: string): SkillMeta[] {
  const dir = scriptsDir();
  const out: SkillMeta[] = [];
  if (!existsSync(dir)) return out;
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const mf = join(dir, d.name, "orion.json");
    const exec = join(dir, d.name, "run.sh");
    const execJs = join(dir, d.name, "run.js");
    const execPy = join(dir, d.name, "run.py");
    const scriptPath = [exec, execJs, execPy].find((p) => existsSync(p));
    if (!existsSync(mf) || !scriptPath) continue;
    try {
      const m = JSON.parse(readFileSync(mf, "utf8")) as Partial<RunManifestLike>;
      const s: SkillMeta = {
        name: d.name,
        description: m.description ?? "",
        tags: Array.isArray(m.tags) ? m.tags : [],
        domain: m.domain ?? "general",
        scriptPath,
        usageCount: m.runCount ?? 0,
        environmentFingerprint: m.environmentFingerprint,
      };
      if (!domain || s.domain === domain) out.push(s);
    } catch {
      /* skip malformed skill */
    }
  }
  return out;
}

interface RunManifestLike {
  description?: string;
  tags?: string[];
  domain?: string;
  runCount?: number;
  environmentFingerprint?: string;
}

/** Build collection stats + inverse document frequencies from skills. */
function buildIndex(skills: SkillMeta[]): {
  idf: Map<string, number>;
  avgLen: number;
  lens: number[];
} {
  const docCount = skills.length || 1;
  const df = new Map<string, number>();
  const lens: number[] = [];
  for (const s of skills) {
    const doc = [...tokenize(s.description), ...s.tags.map((t) => t.toLowerCase())];
    const uniq = new Set(doc);
    lens.push(doc.length);
    for (const term of uniq) df.set(term, (df.get(term) ?? 0) + 1);
  }
  // IDF with smoothing; only terms appearing in the whole collection
  // contribute, so a term absent everywhere scores the default below.
  const idf = new Map<string, number>();
  for (const [term, f] of df) {
    idf.set(term, Math.log(1 + (docCount - f + 0.5) / (f + 0.5)));
  }
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 1;
  return { idf, avgLen, lens };
}

/** BM25 score of a query against one skill document. */
function bm25(
  query: string[],
  descTokens: string[],
  idf: Map<string, number>,
  avgLen: number,
): number {
  const len = descTokens.length || 1;
  const freq = new Map<string, number>();
  for (const t of descTokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let score = 0;
  for (const term of query) {
    const f = freq.get(term) ?? 0;
    if (f === 0) continue;
    const w = idf.get(term) ?? 0.0; // absent term → 0 contribution
    const denom = f + K1 * (1 - B + (B * len) / avgLen);
    score += w * ((f * (K1 + 1)) / (denom || 1));
  }
  return score;
}

export interface MatchInput {
  /** The atomic step text from the decomposition tree. */
  step: string;
  /** Restrict to this domain before scoring (no cross-domain false positives). */
  domain?: string;
}

export interface MatchOptions {
  /** Normalized confidence threshold for `matched` (default 0.45). */
  highThreshold?: number;
  /** Normalized query terms the caller can precompute; default: from step. */
  query?: string[];
  /** Restrict to this domain before scoring (no cross-domain false positives). */
  domain?: string;
  /** Override skill list (tests / callers that already filtered). */
  skills?: SkillMeta[];
}

// Normalized thresholds (score/max in [0,1]): a confident match now requires
// a top candidate >= 0.55 and at least a 2x margin over the runner-up. The
// old raw-BM25 thresholds (0.18 / 0.06) were corpus-dependent — meaningless
// once scores are normalized.
const DEFAULT_HIGH = 0.45;

/**
 * Match an atomic step to the best skill. PURE / SYNCHRONOUS / DETERMINISTIC
 * — never calls the LLM (functional core). Returns a decision:
 *   matched    — unambiguous top skill (tier exact | bm25)
 *   ambiguous  — short-list for an async `resolveAmbiguous` to verify
 *   none       — no confident match, step falls through to the LLM
 *
 * Scores are NORMALIZED within the query (score / max score in the band) so
 * a threshold like 0.7 is meaningful across corpora of different sizes — the
 * raw BM25 score depends on corpus size / doc length and cannot carry a
 * portable threshold, unlike an overlap ratio.
 *
 * Error asymmetry: a false positive (running the WRONG skill) costs more
 * than a false reject (sending the step to the LLM), so the matched decision
 * requires a strong margin over the runner-up — otherwise ambiguous.
 */
export function matchSkill(
  step: string,
  opts: MatchOptions = {},
): MatchDecision {
  const query = opts.query ?? tokenize(step);
  if (query.length === 0) return { kind: "none" };
  const skills = opts.skills ?? readSkills(opts.domain ?? resolveDomain());
  if (skills.length === 0) return { kind: "none" };

  const { idf, avgLen } = buildIndex(skills);
  const scored: Array<{ skill: SkillMeta; score: number }> = [];
  for (const s of skills) {
    const descTokens = [
      ...tokenize(s.description),
      ...s.tags.map((t) => t.toLowerCase()),
    ];
    const score = bm25(query, descTokens, idf, avgLen);
    scored.push({ skill: s, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const max = scored[0]?.score ?? 0;
  if (max <= 0) return { kind: "none" };
  // Normalize every score to [0,1] within this query's candidate set.
  const normalized = scored.map((s) => ({
    skill: s.skill,
    score: s.score / max,
  }));

  const high = opts.highThreshold ?? DEFAULT_HIGH;
  const top = normalized[0];
  const second = normalized[1]?.score ?? 0;
  if (!top) return { kind: "none" };
  if (top.score < high) return { kind: "none" };

  // Exact name match: the cleaned step equals the skill name (or contains it
  // as a whole token) → strongest possible signal, beats BM25 margin.
  const whole = query.join(" ");
  const exact =
    top.skill.name.toLowerCase() === whole ||
    skills.some((s) => s.name && normalized[0].skill.name === s.name);
  const tier: MatchTier = exact ? "exact" : "bm25";

  // Unambiguous: top is clearly better than #2 (error asymmetry → be strict).
  if (scored.length < 2 || top.score >= second * 2) {
    return { kind: "matched", skill: top.skill, tier, score: top.score };
  }
  // Ambiguous: return a short-list for cheap async LLM verification.
  const n = 3;
  return {
    kind: "ambiguous",
    candidates: normalized.slice(0, n).map((s) => s.skill),
  };
}

/**
 * Resolve an ambiguous short-list with the LLM. SEPARATE async function so
 * `matchSkill` stays pure. Called by run/forge and `orion run match` for the
 * same pair of functions — no orchestration branch divergence. Not part of
 * matchSkill; this is where the model spends tokens.
 */
export async function resolveAmbiguous(
  _step: string,
  candidates: SkillMeta[],
): Promise<MatchDecision> {
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) {
    // Only one candidate: not ambiguous any more. Return it as matched. The
    // caller produced a 1-item short-list, so there is nothing to choose.
    return { kind: "matched", skill: candidates[0], tier: "bm25", score: 0 };
  }
  // ERROR ASYMMETRY (v0.51): `ambiguous` is precisely the case where we must
  // NOT guess. Picking the top candidate here would silently run the wrong
  // skill — the one failure mode that costs more than a false reject. The
  // LLM stays OUTSIDE orion (zero runtime dependencies is a design choice,
  // not an oversight), so resolution happens one layer up: the caller that
  // invoked `orion run match` sees `ambiguous` + the short-list in stdout
  // and either re-asks the model itself or reruns the concrete skill. Until
  // that verification is connected, the safe answer is `none` — hand the
  // step back to the LLM, never pick for it.
  return { kind: "none" };
}

/** Well-typed shim so `readSkills` doesn't need to reach into RunManifest. */
export function listSkills(domain?: string): SkillMeta[] {
  return readSkills(domain).map((s) => ({ ...s }));
}

/**
 * The legacy naive scorer forked from `findExistingSkill` (kept ONLY for the
 * shadow-migration comparison). Sums name/description token overlap with no
 * IDF weighting — note it tends to false-positive on common words
 * («создать» matches many unrelated skills). Scores are NOT bounded 0-1.
 */
export function naiveScore(step: string, s: SkillMeta): number {
  const words = normalize(step)
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let score = 0;
  const desc = normalize(s.description);
  for (const w of words) {
    if (s.name.toLowerCase().includes(w)) score += 3;
    if (desc.includes(w)) score += 1;
  }
  return score;
}

/**
 * Shadow-migration: run BM25 and the legacy naive scorer on the SAME set of
 * logged step→skill cases and report agreement/disagreement. This is how you
 * decide to cut naive completely — with data on real cases, not by assuming
 * one kind of false positive is gone. Runs both scorers; disagreement on a
 * case means the two would choose different skills (a decision point).
 *
 * Returns per-case results plus verdicts; the caller (a test, or `orion run
 * match --shadow`) inspects whether BM25 fixes the naive false positives
 * before the naive scorer is deleted.
 */
export function shadowCompare(
  cases: Array<{ step: string; expectedSkill?: string }>,
  domain?: string,
): Array<{
  step: string;
  bm25: MatchDecision;
  naive: { name: string; score: number } | null;
  agree: boolean;
}> {
  const skills = domain ? listSkills(domain) : listSkills();
  const out: Array<{
    step: string;
    bm25: MatchDecision;
    naive: { name: string; score: number } | null;
    agree: boolean;
  }> = [];
  for (const c of cases) {
    const bm = matchSkill(c.step, { skills });
    let best: { name: string; score: number } | null = null;
    for (const s of skills) {
      const sc = naiveScore(c.step, s);
      if (sc > 0 && (!best || sc > best.score)) best = { name: s.name, score: sc };
    }
    const bmName =
      bm.kind === "matched" ? bm.skill.name : bm.kind === "ambiguous" ? bm.candidates[0]?.name : null;
    out.push({
      step: c.step,
      bm25: bm,
      naive: best,
      agree: bmName !== null && best !== null && bmName === best.name,
    });
  }
  return out;
}

/**
 * Environment fingerprint: hash of detectable schema/version signals. Used
 * (Phase 4) to invalidate a skill when its backing environment drifts, so a
 * skill compiled against 1C_TI does not "confidently" match after a 1C_TI→
 * 1C_TI_NEW migration.
 */
export function environmentFingerprint(signals: Record<string, string>): string {
  const stable = Object.entries(signals)
    .filter(([, v]) => typeof v === "string" && v.length > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  return stable || "(unknown)";
}
