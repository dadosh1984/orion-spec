/**
 * orion chat — one-command pipeline (v0.61).
 *
 * draft → clarify → answer → refine → out.
 * With --auto: uses LLM for clarifying questions; blockers still need human.
 */

import { existsSync, readdirSync } from 'node:fs';
import { think } from '../skills/think/handler.js';
import { draft } from '../skills/draft/handler.js';
import {
  generateQuestions,
  hasUnansweredBlockers,
  refine,
  applyAnswers,
  loadClarifyState,
} from '../core/clarify.js';
import { askWithFallback } from '../core/llm/index.js';
import type { Answer } from '../core/clarify.js';

const EMOJI = {
  blocker: '\u{1F6A8}',
  clarifying: '\u{2753}',
  done: '\u{2714}\u{FE0F}',
  info: '\u{2139}\u{FE0F}',
  llm: '\u{1F916}',   // 🤖
};

/** orion chat <prompt> [--auto] */
export async function chatCommand(prompt: string, auto = false): Promise<number> {
  // 1. Draft phase — use proposal.title from think as single source of truth
  let changeId: string;

  // Check for existing change by matching prompt slug against changes dir
  const maybeSlug = slugify(prompt);
  const changesDir = 'changes';
  if (existsSync(changesDir)) {
    const entries = readdirSync(changesDir);
    const existing = entries.find(e => e === maybeSlug || e.startsWith(maybeSlug));
    if (existing) {
      changeId = existing;
      console.log(`${EMOJI.info} Re-entering change: ${changeId}`);
    } else {
      // New change — think + draft
      const proposal = await think(prompt, {});
      if (!proposal || !proposal.title) {
        console.error('orion: chat — think failed to produce a proposal');
        return 1;
      }
      changeId = proposal.title;
      const artifacts = await draft(changeId, { noCache: false, lang: 'ru' });
      if (!artifacts) {
        console.error(`orion: chat — draft failed for "${changeId}"`);
        return 1;
      }
      console.log(`${EMOJI.done} Created change: ${changeId}`);
    }
  } else {
    // New project — think + draft
    const proposal = await think(prompt, {});
    if (!proposal || !proposal.title) {
      console.error('orion: chat — think failed to produce a proposal');
      return 1;
    }
    changeId = proposal.title;
    const artifacts = await draft(changeId, { noCache: false, lang: 'ru' });
    if (!artifacts) {
      console.error(`orion: chat — draft failed for "${changeId}"`);
      return 1;
    }
    console.log(`${EMOJI.done} Created change: ${changeId}`);
  }

  // 2. Clarify loop
  const clarifyResolved = await resolveQuestions(changeId, prompt, auto);
  if (!clarifyResolved.ok) {
    return clarifyResolved.exitCode;
  }

  // 3. Refine phase
  const blockersMsg = refine(changeId, true);
  if (blockersMsg) {
    console.error(`${EMOJI.blocker} ${blockersMsg}`);
    return 1;
  }
  console.log(`${EMOJI.done} Context refined.`);

  // 4. Done
  const state = loadClarifyState(changeId);
  console.log(`${EMOJI.done} Socrates dialogue complete (${state.dialogue.length} exchanges).`);
  console.log(`  Continue with:  orion forge ${changeId}`);
  console.log(`  Finalize with:  orion out ${changeId}`);
  return 0;
}

/** Handle clarify: auto-answer clarifying questions or print them. */
async function resolveQuestions(
  changeId: string,
  prompt: string,
  auto: boolean,
): Promise<{ ok: boolean; exitCode: number }> {
  const allQuestions = generateQuestions(changeId);
  // Check if there are any NEW questions (unanswered blockers)
  const questions = allQuestions.filter(q => !q.resolved);
  if (questions.length === 0) {
    // Re-entrant check
    if (hasUnansweredBlockers(changeId)) {
      console.error(`${EMOJI.blocker} Unanswered blockers remain for ${changeId}.`);
      return { ok: false, exitCode: 1 };
    }
    console.log(`${EMOJI.done} All clear — no questions.`);
    return { ok: true, exitCode: 0 };
  }

  const blockers = questions.filter(q => q.priority === 'blocker');
  const clarifying = questions.filter(q => q.priority === 'clarifying');

  // Blockers always block (safety)
  if (blockers.length > 0) {
    for (const q of blockers) {
      console.log(`${EMOJI.blocker} [${q.id}] ${q.text}`);
    }
    console.error(`\n${EMOJI.blocker} ${blockers.length} blocker(s) require human resolution.`);
    console.error(`  orion answer ${changeId} <answers.json>`);
    console.error(`  Then retry: orion chat "${prompt}"`);
    return { ok: false, exitCode: 1 };
  }

  // Clarifying: auto-answer if --auto, otherwise print
  if (clarifying.length === 0) {
    return { ok: true, exitCode: 0 };
  }

  if (!auto) {
    for (const q of clarifying) {
      console.log(`${EMOJI.clarifying} [${q.id}] ${q.text}`);
    }
    console.log(`\n${EMOJI.clarifying} ${clarifying.length} clarifying question(s).`);
    console.log(`  orion answer ${changeId} <answers.json>`);
    console.log(`  Then retry: orion chat "${prompt}"`);
    return { ok: false, exitCode: 1 };
  }

  // --auto mode: answer clarifying questions via LLM (or fallback)
  const proposal = await readProposal(changeId);
  const goal = proposal?.goal ?? '';
  const context = proposal?.context ?? '';

  const answers: Answer[] = [];
  for (const q of clarifying) {
    process.stderr.write(`${EMOJI.llm} Answering [${q.id}]... `);
    const text = await askWithFallback(q, goal, context);
    answers.push({
      questionId: q.id,
      text,
      ts: new Date().toISOString(),
    });
    process.stderr.write(`${text}\n`);
  }

  applyAnswers(changeId, answers);
  console.log(`${EMOJI.done} ${answers.length} clarifying question(s) auto-answered.`);
  return { ok: true, exitCode: 0 };
}

async function readProposal(changeId: string): Promise<{ goal?: string; context?: string } | null> {
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    const path = `changes/${changeId}/proposal.json`;
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
}
