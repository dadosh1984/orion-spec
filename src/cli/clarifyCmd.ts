/**
 * SocratesEngine CLI commands (v0.58).
 *
 * orion clarify <change-id>   — generate questions
 * orion answer <change-id> --json <file> — provide answers
 * orion refine <change-id>    — merge answers into proposal
 */

import { readFileSync, existsSync } from 'node:fs';
import { generateQuestions, applyAnswers, hasUnansweredBlockers, refine, loadClarifyState } from '../core/clarify.js';
import type { Answer } from '../core/clarify.js';

const EMOJI = {
  blocker: '\u{1F6A8}',   // 🚨
  clarifying: '\u{2753}',  // ❓
  done: '\u{2714}\u{FE0F}', // ✔️
};

/** orion clarify <change-id> */
export async function clarifyCommand(args: string[]): Promise<number> {
  const [changeId] = args;
  if (!changeId) {
    console.error('orion: clarify requires a change id, e.g. orion clarify my-change');
    return 1;
  }
  if (!existsSync(`changes/${changeId}`)) {
    console.error(`orion: change "${changeId}" not found under changes/`);
    return 1;
  }

  const questions = generateQuestions(changeId);

  // Show only unresolved questions
  const unresolved = questions.filter(q => !q.resolved);
  if (unresolved.length === 0) {
    console.log(`${EMOJI.done} No clarifying questions — all clear.`);
    return 0;
  }

  for (const q of unresolved) {
    const icon = q.priority === 'blocker' ? EMOJI.blocker : EMOJI.clarifying;
    console.log(`${icon} [${q.id}] ${q.text} (${q.category})`);
  }

  const blockers = unresolved.filter(q => q.priority === 'blocker').length;
  if (blockers > 0) {
    console.error(`\norion: ${blockers} blocker(s) found — resolve before orion out`);
    return 1;
  }
  return 0;
}

/** orion answer <change-id> --json <file> */
export async function answerCommand(args: string[], _flags: unknown): Promise<number> {
  const [changeId, jsonPath] = args;
  if (!changeId || !jsonPath) {
    console.error('orion: answer requires: orion answer <change-id> <answers.json>');
    return 1;
  }
  if (!existsSync(`changes/${changeId}`)) {
    console.error(`orion: change "${changeId}" not found under changes/`);
    return 1;
  }

  let raw: string;
  if (jsonPath === '-') {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  } else {
    if (!existsSync(jsonPath)) {
      console.error(`orion: answers file not found: ${jsonPath}`);
      return 1;
    }
    raw = readFileSync(jsonPath, 'utf8');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('orion: invalid JSON in answers file');
    return 1;
  }

  let answers: Answer[];
  if (Array.isArray(parsed)) {
    answers = parsed as Answer[];
  } else if (parsed && typeof parsed === 'object' && 'answers' in parsed) {
    answers = (parsed as { answers: Answer[] }).answers;
  } else {
    console.error('orion: invalid answers format — expected array or { answers: [] }');
    return 1;
  }

  // Validate
  for (const a of answers) {
    if (!a.questionId || typeof a.text !== 'string') {
      console.error(`orion: invalid answer entry — must have "questionId" and "text"`);
      return 1;
    }
    a.ts = a.ts || new Date().toISOString();
  }

  applyAnswers(changeId, answers);

  const remaining = hasUnansweredBlockers(changeId);
  console.log(`${EMOJI.done} ${answers.length} answer(s) applied.`);
  if (remaining) {
    console.log(`${EMOJI.blocker} Blockers remaining — use orion clarify ${changeId} to review`);
  } else {
    console.log(`${EMOJI.done} All blockers resolved! Ready for orion out ${changeId}`);
  }
  return 0;
}

/** orion refine <change-id> [--auto] */
export async function refineCommand(args: string[], auto = false): Promise<number> {
  const [changeId] = args;
  if (!changeId) {
    console.error('orion: refine requires a change id, e.g. orion refine my-change');
    return 1;
  }
  if (!existsSync(`changes/${changeId}`)) {
    console.error(`orion: change "${changeId}" not found under changes/`);
    return 1;
  }

  try {
    const blockersMsg = refine(changeId, auto);
    const state = loadClarifyState(changeId);
    const answered = state.answers.length;
    console.log(`${EMOJI.done} Context refined for "${changeId}" (${answered} answer(s) merged).`);

    if (blockersMsg) {
      console.error(`${EMOJI.blocker} ${blockersMsg}`);
      console.error('  Resolve blockers with orion answer, then retry refine --auto.');
      return 1;
    }

    console.log('  Run: orion forge <change-id> to apply updated context.');
    return 0;
  } catch (err) {
    console.error(`orion: refine failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
