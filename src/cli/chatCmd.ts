/**
 * orion chat — one-command pipeline: draft → clarify → wait/answer → refine → out (v0.61).
 *
 * Iterative: runs draft + clarify. If blockers/questions exist, prints them and
 * exits with instructions. User answers via `orion answer`, then re-runs `orion chat`
 * which continues from clarify (skips draft if proposal exists).
 */

import { existsSync } from 'node:fs';
import { think } from '../skills/think/handler.js';
import { draft } from '../skills/draft/handler.js';
import { generateQuestions, hasUnansweredBlockers, refine, loadClarifyState } from '../core/clarify.js';

const EMOJI = {
  blocker: '\u{1F6A8}',
  clarifying: '\u{2753}',
  done: '\u{2714}\u{FE0F}',
  info: '\u{2139}\u{FE0F}',
};

/** orion chat <prompt> */
export async function chatCommand(prompt: string): Promise<number> {
  // 1. Draft phase — skip if change already exists (re-entrant)
  const title = slugify(prompt);
  const changeDir = `changes/${title}`;
  const isNew = !existsSync(changeDir);

  let changeId: string;

  if (isNew) {
    // think → draft
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
  } else {
    changeId = title;
    console.log(`${EMOJI.info} Re-entering change: ${changeId}`);
  }

  // 2. Clarify phase — check existing blockers first, avoid re-generating
  if (!isNew) {
    // Re-entrant: check if already resolved
    if (hasUnansweredBlockers(changeId)) {
      // Regenerate to get fresh questions (existing ones will be deduped)
      const questions = generateQuestions(changeId);
      printQuestionsAndExit(changeId, questions, prompt);
      return 1;
    }
    // All blockers resolved — skip clarify
    console.log(`${EMOJI.done} All blockers already resolved.`);
  } else {
    // New change: run clarify
    const questions = generateQuestions(changeId);
    if (questions.length > 0) {
      printQuestionsAndExit(changeId, questions, prompt);
      return 1;
    }
    console.log(`${EMOJI.done} No clarifying questions needed.`);
  }

  // 3. Refine phase
  const blockersMsg = refine(changeId, true);
  if (blockersMsg) {
    console.error(`${EMOJI.blocker} ${blockersMsg}`);
    console.error(`  Provide answers via: orion answer ${changeId} <answers.json>`);
    return 1;
  }
  console.log(`${EMOJI.done} Context refined.`);

  // 4. Forge phase — print instruction (forge is heavy, let user run it)
  const state = loadClarifyState(changeId);
  console.log(`${EMOJI.done} Socrates dialogue complete (${state.dialogue.length} exchanges).`);
  console.log(`  Continue with:  orion forge ${changeId}`);
  console.log(`  Finalize with:  orion out ${changeId}`);
  return 0;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
}

function printBlockerReminder(changeId: string): void {
  console.error(`${EMOJI.blocker} Unanswered blockers still exist for ${changeId}.`);
  console.error(`  Check them:  orion clarify ${changeId}`);
  console.error(`  Answer them: orion answer ${changeId} <answers.json>`);
}

function printQuestionsAndExit(
  changeId: string,
  questions: import('../core/clarify.js').Question[],
  prompt?: string,
): void {
  if (questions.length === 0) {
    console.log(`${EMOJI.done} No clarifying questions needed.`);
    return;
  }
  const blockers = questions.filter(q => q.priority === 'blocker');
  const clarifying = questions.filter(q => q.priority === 'clarifying');

  for (const q of questions) {
    const icon = q.priority === 'blocker' ? EMOJI.blocker : EMOJI.clarifying;
    console.log(`${icon} [${q.id}] ${q.text}`);
  }

  if (blockers.length > 0) {
    console.error(`\n${EMOJI.blocker} ${blockers.length} blocker(s) require resolution before out.`);
    console.error(`  Provide answers via: orion answer ${changeId} <answers.json>`);
    console.error(`  Then retry:           orion chat "${prompt ?? changeId}"`);
  }
  if (clarifying.length > 0) {
    console.log(`\n${EMOJI.clarifying} ${clarifying.length} clarifying question(s).`);
    console.log(`  Provide answers via: orion answer ${changeId} <answers.json>`);
    console.log(`  Then retry:           orion chat "${prompt ?? changeId}"`);
  }
}
