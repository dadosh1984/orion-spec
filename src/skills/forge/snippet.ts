import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Snippet resolution for `orion forge` (v0.25).
 *
 * forge waits for `changes/<title>/snippets/<slug>.ts`, where the slug is
 * derived deterministically from the CURRENT task text (shortSlug, v0.24).
 * Files written under any other name — legacy long slugs from before
 * v0.24 (`fact_v77_reader_1cv77_dat_id_nnn_yyyymmdd.ts`), or agent-guessed
 * names — used to produce a false `missingSnippets` even though the
 * content existed. This resolver:
 *
 * 1. exact match always wins;
 * 2. otherwise a UNIQUE legacy/prefix candidate is accepted (slug tokens
 *    found in the marker-stripped basename, or basename starting with the
 *    slug) — ambiguity is a miss, never a silent guess;
 * 3. a genuine miss returns the existing files (near-misses first) so the
 *    agent can rename instead of re-creating.
 *
 * Deterministic and zero-dependency; reads are sorted and never throw.
 */

/** Result of resolving the implementation snippet for a task slug. */
export interface SnippetResolution {
  /** Snippet content, or null when no file could be resolved. */
  content: string | null;
  /** Path that was used, when resolved. */
  path?: string;
  /** How it matched: exact file name, or legacy/prefix fallback. */
  mode?: "exact" | "legacy";
  /** Existing snippet files, near-misses first, when nothing matched. */
  candidates?: string[];
}

/** Old-style slug prefixes (task marker + `_`) from before v0.24. */
const LEGACY_MARKER = /^(fact|assumption|risk|decision|spike)_/i;

function basenameTokens(base: string): string[] {
  return base
    .split("_")
    .filter((t) => t.length > 0 && !/^\d+$/.test(t));
}

export function resolveSnippet(
  snippetsDir: string,
  slug: string,
): SnippetResolution {
  let files: string[];
  try {
    files = readdirSync(snippetsDir).filter((f) => f.endsWith(".ts")).sort();
  } catch {
    files = [];
  }

  // 1) Exact match — always wins.
  if (files.includes(`${slug}.ts`)) {
    return {
      content: readFileSync(join(snippetsDir, `${slug}.ts`), "utf8"),
      path: join(snippetsDir, `${slug}.ts`),
      mode: "exact",
    };
  }

  const want = basenameTokens(slug);
  if (want.length === 0) return { content: null, candidates: files };

  // 2) Legacy/prefix fallback — accept only a UNIQUE best candidate.
  let best: { file: string; score: number } | undefined;
  let ties = false;
  for (const file of files) {
    const norm = file.slice(0, -3).replace(LEGACY_MARKER, "");
    const score =
      norm.startsWith(slug)
        ? want.length + 1
        : want.filter((t) => basenameTokens(norm).includes(t)).length;
    if (score < Math.min(2, want.length)) continue;
    if (!best || score > best.score) {
      best = { file, score };
      ties = false;
    } else if (score === best.score) {
      ties = true;
    }
  }
  if (best && !ties) {
    return {
      content: readFileSync(join(snippetsDir, best.file), "utf8"),
      path: join(snippetsDir, best.file),
      mode: "legacy",
    };
  }

  // 3) Honest miss: near-misses first, then the full file list.
  const scored = files
    .map((f) => ({
      file: f,
      score: want.filter((t) =>
        basenameTokens(f.slice(0, -3).replace(LEGACY_MARKER, "")).includes(t),
      ).length,
    }))
    .filter((f) => f.score >= 1)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .map((f) => f.file);
  return { content: null, candidates: scored.length > 0 ? scored : files };
}
