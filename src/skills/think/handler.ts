import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { readJson, writeJson } from "../../utils/file.js";
import { OrionTrack } from "../../core/track.js";
import type { Proposal } from "../../type.js";

/** One guided question in the `think` flow. */
export interface Question {
  msg: string;
  key: keyof Proposal;
}

/** The guided questions asked by `orion think`. The goal comes from the prompt. */
export const QUESTIONS: Question[] = [
  { msg: "Which platform / environment is the target?", key: "platform" },
  { msg: "Any constraints (perf, size, deps)?", key: "constraints" },
  { msg: "What is the token/time budget?", key: "budget" },
];

/** Ask a single question on stdin, resolving with the trimmed answer. */
export async function askQuestion(msg: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`? ${msg} `, resolve);
    });
    return answer.trim();
  } finally {
    rl.close();
  }
}

/**
 * `orion think` — turn a high-level prompt into a Proposal object by
 * asking a handful of guided questions. The ask function is injectable
 * so tests can mock stdin.
 *
 * Context-driven decisions (no flags):
 * - same idea already captured → returns the existing proposal unchanged;
 * - title collision with a *different* idea → asks in an interactive
 *   terminal, otherwise auto-suffixes (`title`, `title-2`, `title-3`, …)
 *   so agents/pipe feeds never clobber an existing proposal.
 */
export async function think(
  prompt: string,
  opts?: { noCache?: boolean },
  ask: (msg: string) => Promise<string> = askQuestion,
): Promise<Proposal> {
  const track = OrionTrack.init();
  const { title, existing } = await resolveTitle(prompt, ask, track);
  if (existing) return existing;

  const proposal: Proposal = {
    title,
    goal: prompt,
    platform: "",
    constraints: "",
    budget: "",
  };

  // Context decides: interactive terminals (or an injected ask, i.e. tests
  // and the MCP server) get the guided questions; non-interactive pipes get
  // a prompt-only proposal without blocking or polluting stdout.
  const interactive = process.stdin.isTTY === true || ask !== askQuestion;
  if (interactive) {
    for (const q of QUESTIONS) {
      const answer = await ask(q.msg);
      if (answer) proposal[q.key] = answer;
    }
  }

  await writeJson(`changes/${proposal.title}/proposal.json`, proposal);
  if (!opts?.noCache) {
    track.store(`proposal:${proposal.title}`, JSON.stringify(proposal));
  }

  return proposal;
}

/** Existing proposal for a title, from cache or disk (null if none). */
async function loadExisting(
  title: string,
  track: OrionTrack,
): Promise<Proposal | null> {
  const cached = track.loadString(`proposal:${title}`);
  if (cached) {
    try {
      return JSON.parse(cached) as Proposal;
    } catch {
      /* corrupted cache entry — fall through to disk */
    }
  }
  try {
    return await readJson<Proposal>(`changes/${title}/proposal.json`);
  } catch {
    return null;
  }
}

/**
 * Resolve the title for a prompt. Returns the existing proposal when the
 * idea was already captured (idempotent), or a fresh unique title.
 */
async function resolveTitle(
  prompt: string,
  ask: (msg: string) => Promise<string>,
  track: OrionTrack,
): Promise<{ title: string; existing: Proposal | null }> {
  const base = slugify(prompt);
  let suffix = 1;
  for (;;) {
    const title = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await loadExisting(title, track);
    if (!existing) return { title, existing: null };
    if (existing.goal === prompt) return { title, existing };
    // Different idea with the same title: interactive terminals get to
    // decide; non-interactive contexts (agents, pipes, MCP) auto-suffix.
    if (process.stdin.isTTY) {
      const answer = await ask(
        `Proposal "${title}" already exists with a different goal. Overwrite? (y/N) `,
      );
      if (/^y/i.test(answer)) return { title, existing: null };
    }
    suffix++;
  }
}

/** Turn a free-form prompt into a filesystem-safe identifier. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "untitled"
  );
}
