import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { readJson, writeJson } from "../../utils/file.js";
import { significantWords } from "../../core/titles.js";
import { OrionTrack } from "../../core/track.js";
import { findLessons } from "../../core/lessons.js";
import { loadQuestions } from "../../core/templates.js";
import { updateProfile, readProfile, profilePath } from "../../core/profile.js";
import {
  notifyLessonsApplied,
  notifyProfileCreated,
} from "../../tasks/lesson_notify_visible.js";
import type { Proposal } from "../../type.js";
import {
  assessPrompt,
  clarifyingQuestions,
  composeGoal,
  detectLanguage,
  extractCore,
  normalizePrompt,
  type PromptAssessment,
} from "./refine.js";
import { guardPrompt } from "./guard.js";
import { classifyTask, formatClassifyResult } from "../../core/classify.js";
import { classifyComplexity } from "./complexity.js";

/** One guided question in the `think` flow. */
export interface Question {
  msg: string;
  key: "platform" | "constraints" | "budget";
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
 * - the raw prompt is normalized and assessed; if it is vague
 *   (missing an action verb or enough detail), interactive terminals
 *   get clarifying questions in their own language and the refined
 *   goal is what flows into draft/specs/tasks;
 * - same idea already captured → returns the existing proposal unchanged;
 * - title collision with a *different* idea → asks in an interactive
 *   terminal, otherwise auto-suffixes (`title`, `title-2`, `title-3`, …)
 *   so agents/pipe feeds never clobber an existing proposal;
 * - prompt drift guard (v0.22): year-dated package tells and placeholder
 *   markers block proposal creation until the caller confirms with
 *   `--force` — a hallucinated dependency must not be chased into RED.
 */
export async function think(
  prompt: string,
  opts?: { noCache?: boolean; force?: boolean },
  ask: (msg: string) => Promise<string> = askQuestion,
): Promise<Proposal> {
  const base = normalizePrompt(prompt);
  // Prompt drift guard (v0.22): stop before the proposal exists, not after
  // a RED cycle. The agent confirms explicitly by passing force: true.
  const guard = guardPrompt(base);
  if (!guard.ok && !opts?.force) {
    throw new Error(
      "Prompt drift guard:" +
        guard.issues.map((i) => `\n  - ${i}`).join("") +
        "\nIf you really mean it, re-run with --force (explicit confirmation).",
    );
  }
  const assessment: PromptAssessment = assessPrompt(base);
  const track = OrionTrack.init();
  const { title, existing } = await resolveTitle(base, ask, track);
  if (existing) return existing;

  // v0.51 «eat an elephant» complexity classifier (zero-LLM).
  const cx = classifyComplexity(base, assessment.language);

  const proposal: Proposal = {
    title,
    goal: base,
    platform: "",
    constraints: "",
    budget: "",
    clarity: assessment.clarity,
    language: assessment.language,
    complexity: cx.complexity,
    depth: cx.depth,
    plannedSteps: cx.plannedSteps,
  };

  // Context decides: interactive terminals (or an injected ask, i.e. tests
  // and the MCP server) get the guided questions; non-interactive pipes get
  // a prompt-only proposal without blocking or polluting stdout.
  const interactive = process.stdin.isTTY === true || ask !== askQuestion;
  if (interactive) {
    // Clarify vague prompts first — the refined goal is what downstream
    // artifacts (draft, specs, tasks) build on.
    if (assessment.clarity === "vague") {
      const clarifications: string[] = [];
      for (const q of clarifyingQuestions(assessment)) {
        const answer = await ask(q.msg);
        if (answer) clarifications.push(answer);
      }
      if (clarifications.length > 0) {
        proposal.goal = composeGoal(base, clarifications);
        proposal.clarity = "clear";
      }
    }

    // Open templates (v0.13): user-editable questions.json replaces the
    // built-in clarifying questions; unknown keys are ignored, never
    // injected into the proposal.
    const questions = loadQuestions() ?? QUESTIONS;
    for (const q of questions) {
      const answer = await ask(q.msg);
      if (
        answer &&
        (q.key === "platform" || q.key === "constraints" || q.key === "budget")
      ) {
        proposal[q.key] = answer;
      }
    }
  }

  // Task category classification (v0.40): recommend skill vs direct AI.
  // Writes a recommendation to stderr so the agent/user sees it immediately.
  const classResult = classifyTask(proposal.goal);
  const skillHint = formatClassifyResult(classResult, proposal.goal);
  if (skillHint && process.stderr.isTTY) {
    process.stderr.write(skillHint + "\n");
  }

  // Self-learning (v0.12): attach past self-correction lessons this idea
  // relates to, so the same mistake is not repeated across projects.
  const hits = findLessons(
    `${proposal.goal} ${proposal.title} ${proposal.platform}`,
  );
  if (hits.length > 0) {
    proposal.appliesLessons = hits.map(
      (l) => `${l.changeId}:${l.step}:${l.id}`,
    );
    // Visible self-correction (v0.26): tell the user the past lessons
    // are being reused instead of silently attaching them.
    notifyLessonsApplied(hits.length);
  }

  // User adaptation (v0.26): remember the user's language, typical
  // platform/budget and frequent topic words in ~/.orion/profile.md —
  // the memory.md analogue. Created on first use (with a one-time
  // notice), updated on every proposal, never clobbers user notes.
  const created = !readProfile().exists;
  updateProfile({
    language: detectLanguage(proposal.goal),
    platform: proposal.platform,
    budget: proposal.budget,
    words: proposal.goal.split(/\s+/),
  });
  if (created) notifyProfileCreated(profilePath());

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
  const base = shortTitle(prompt);
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

/**
 * Short, readable change title (3–4 words) derived from the prompt:
 * strip the leading action verb and fillers, drop stopwords, keep the
 * first few significant words — Latin **and** Cyrillic — so Russian
 * prompts get short meaningful titles instead of `untitled` or a single
 * stray ASCII word. Falls back to the raw prompt's first significant
 * words when too little remains (keeps "build a calculator" →
 * build-a-calculator exactly as before). `slugify` itself is unchanged,
 * so forge task slugs are unaffected.
 */
export function shortTitle(prompt: string): string {
  // Significant words of the core (leading verb already stripped).
  const words = significantWords(extractCore(prompt), 4);
  if (words.length >= 2) return words.join("-");
  // Too little survives the core filter — fall back to the raw prompt's
  // first significant words (Cyrillic included), never a 64-char slug or
  // "untitled" for a non-empty idea.
  const raw = significantWords(prompt, 4);
  if (raw.length >= 2) return raw.join("-");
  return slugify(prompt) || "untitled";
}
