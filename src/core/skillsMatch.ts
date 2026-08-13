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

export type MatchVerdict =
  | { decision: "USE_SKILL"; skill: SkillMeta; score: number }
  | { decision: "CANDIDATES"; candidates: SkillMeta[]; scores: number[] }
  | { decision: "NO_MATCH" };

/** BM25 tuning knobs (Okapi). k1 ~ 1.2, b ~ 0.75 are the classic defaults. */
const K1 = 1.2;
const B = 0.75;

function scriptsDir(): string {
  return process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion", "scripts");
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
  /** Confidence threshold for USE_SKILL. Default = single top candidate
   * with a clear margin and a nonzero definite term overlay. */
  highThreshold?: number;
  /** Borderline window below high — returns candidates for LLM verify. */
  candidateThreshold?: number;
  /** Normalized query terms the caller can precompute; default: from step. */
  query?: string[];
  /** Restrict to this domain before scoring (no cross-domain false positives). */
  domain?: string;
  /** Override skill list (tests / callers that already filtered). */
  skills?: SkillMeta[];
}

const DEFAULT_HIGH = 0.18;
const DEFAULT_CANDIDATE = 0.06;

/**
 * Match an atomic step to the best skill. Greedy on precision: only an
 * unambiguous top-1 with a strong margin becomes USE_SKILL; anything in
 * the borderline window becomes CANDIDATES (LLM verifies a short list);
 * everything below is NO_MATCH letting the step fall through to the LLM.
 */
export function matchSkill(
  step: string,
  opts: MatchOptions = {},
): MatchVerdict {
  const query = opts.query ?? tokenize(step);
  if (query.length === 0) return { decision: "NO_MATCH" };
  const skills = opts.skills ?? readSkills(opts.domain);
  if (skills.length === 0) return { decision: "NO_MATCH" };

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

  const high = opts.highThreshold ?? DEFAULT_HIGH;
  const cand = opts.candidateThreshold ?? DEFAULT_CANDIDATE;
  const top = scored[0];
  if (!top || top.score < cand) return { decision: "NO_MATCH" };

  // Unambiguous: top-1 above high AND a clear margin over #2.
  const second = scored[1]?.score ?? 0;
  if (top.score >= high && (scored.length < 2 || top.score >= second * 1.5)) {
    return { decision: "USE_SKILL", skill: top.skill, score: top.score };
  }
  // Borderline: return top-N candidates for cheap LLM verification.
  const n = 3;
  return {
    decision: "CANDIDATES",
    candidates: scored.slice(0, n).map((s) => s.skill),
    scores: scored.slice(0, n).map((s) => s.score),
  };
}

/** Well-typed shim so `readSkills` doesn't need to reach into RunManifest. */
export function listSkills(domain?: string): SkillMeta[] {
  return readSkills(domain).map((s) => ({ ...s }));
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
