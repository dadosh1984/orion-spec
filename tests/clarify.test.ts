/**
 * Tests for SocratesEngine — rule-based clarifying question generator (v0.58).
 *
 * Uses memoryStore pattern following lessons.test.ts convention.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SocratesEngine, generateQuestions, applyAnswers, hasUnansweredBlockers, loadClarifyState, refine } from '../src/core/clarify.js';
import { clarifyStore } from '../src/core/clarifyStore.js';
import type { Proposal } from '../src/type.js';
import type { Answer } from '../src/core/clarify.js';

let dir: string;
const ORIGINAL_CWD = process.cwd();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orion-clarify-'));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, 'cache');
  process.env.ORION_SHIELD_SKIP_SHELL = '1';
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

function createChangeDir(id: string): string {
  const changeDir = `changes/${id}`;
  mkdirSync(changeDir, { recursive: true });
  const snippetsDir = `${changeDir}/snippets`;
  mkdirSync(snippetsDir, { recursive: true });
  return changeDir;
}

function writeProposal(changeId: string, overrides: Partial<Proposal> = {}): void {
  const p: Proposal = {
    title: changeId,
    goal: 'Implement a simple feature',
    platform: '',
    constraints: '',
    budget: '',
    ...overrides,
  };
  writeFileSync(`changes/${changeId}/proposal.json`, JSON.stringify(p, null, 2));
}

describe('SocratesEngine', () => {
  it('generates hazard blocker when snippet contains rmSync', () => {
    const id = 'test-hazard';
    createChangeDir(id);
    writeFileSync(`changes/${id}/snippets/deploy.ts`, `
      import { rmSync } from 'node:fs';
      rmSync('/tmp/test', { recursive: true });
    `);
    writeProposal(id);

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'Deploy script', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });

    expect(questions.length).toBeGreaterThan(0);
    const hazardQ = questions.find(q => q.category === 'hazard');
    expect(hazardQ).toBeDefined();
    expect(hazardQ!.priority).toBe('blocker');
    expect(hazardQ!.text).toContain('rmSync');
  });

  it('generates ambiguity blocker for vague goal', () => {
    const id = 'test-ambig';
    createChangeDir(id);
    writeProposal(id, { goal: 'улучшить производительность' });

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'улучшить производительность', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });

    const ambigQ = questions.find(q => q.category === 'ambiguity');
    expect(ambigQ).toBeDefined();
    expect(ambigQ!.priority).toBe('blocker');
    expect(ambigQ!.text).toContain('улучшить');
  });

  it('generates clarifying question for TODO in snippet', () => {
    const id = 'test-todo';
    createChangeDir(id);
    writeFileSync(`changes/${id}/snippets/auth.ts`, `
      function login() {
        // TODO: add validation
        return true;
      }
    `);
    writeProposal(id);

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'Add auth', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });

    const todoQ = questions.find(q => q.category === 'incomplete');
    expect(todoQ).toBeDefined();
    expect(todoQ!.priority).toBe('clarifying');
    expect(todoQ!.text).toContain('TODO');
  });

  it('generates test clarifying question when code exists without tests', () => {
    const id = 'test-notest';
    createChangeDir(id);
    writeFileSync(`changes/${id}/snippets/calc.ts`, `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `);
    writeProposal(id);

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'Calculator', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });

    const testQ = questions.find(q => q.category === 'test');
    expect(testQ).toBeDefined();
    expect(testQ!.priority).toBe('clarifying');
  });

  it('skips already-answered questions', () => {
    const id = 'test-dedup';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    // First pass: generate questions
    const engine1 = new SocratesEngine();
    const qs1 = engine1.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });
    expect(qs1.some(q => q.category === 'ambiguity')).toBe(true);

    // Second pass: with existing questions and answers (simulating answered)
    const answered = qs1.filter(q => q.category === 'ambiguity').map(q => ({
      questionId: q.id,
      text: 'Will extract to 3 smaller modules',
      ts: new Date().toISOString(),
    }));

    const engine2 = new SocratesEngine();
    const qs2 = engine2.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
      existingQuestions: qs1,
      existingAnswers: answered,
    });

    // Should not regenerate the same answered question
    const ambigAgain = qs2.filter(q => q.category === 'ambiguity');
    expect(ambigAgain.length).toBe(0);
  });
});

describe('applyAnswers / hasUnansweredBlockers', () => {
  it('applyAnswers marks questions resolved', () => {
    const id = 'test-apply';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });
    const store = clarifyStore(id);
    store.questions.replace(questions);

    // Apply an answer to the ambiguity blocker
    const ambigQ = questions.find(q => q.category === 'ambiguity');
    expect(ambigQ).toBeDefined();
    applyAnswers(id, [{ questionId: ambigQ!.id, text: 'Will extract to 3 smaller modules', ts: new Date().toISOString() }]);

    // Check: question is now resolved
    const state = loadClarifyState(id);
    const resolvedQ = state.questions.find(q => q.id === ambigQ!.id);
    expect(resolvedQ?.resolved).toBe(true);
    expect(state.answers.length).toBe(1);
    expect(state.answers[0].questionId).toBe(ambigQ!.id);
  });

  it('hasUnansweredBlockers returns true when blocker unanswered', () => {
    const id = 'test-blocked';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });
    const store = clarifyStore(id);
    store.questions.replace(questions);

    // No answers yet -> blockers exist
    const blockers = questions.filter(q => q.priority === 'blocker').length;
    expect(blockers).toBeGreaterThan(0);
    expect(hasUnansweredBlockers(id)).toBe(true);
  });

  it('hasUnansweredBlockers returns false after all blockers answered', () => {
    const id = 'test-unblocked';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });
    const store = clarifyStore(id);
    store.questions.replace(questions);

    // Answer ALL blockers
    const answers = questions
      .filter(q => q.priority === 'blocker')
      .map(q => ({ questionId: q.id, text: 'Blockers acknowledged', ts: new Date().toISOString() }));
    applyAnswers(id, answers);

    expect(hasUnansweredBlockers(id)).toBe(false);
  });
});

describe('generateQuestions helper', () => {
  it('persists questions to files', () => {
    const id = 'test-gen';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    // persist questions
    generateQuestions(id);
    const store = clarifyStore(id);
    const loaded = store.questions.load();
    expect(loaded.length).toBeGreaterThan(0);
  });
});

describe('refine', () => {
  it('merges answers into proposal and updates context', async () => {
    const id = 'test-refine';
    createChangeDir(id);
    writeProposal(id, { goal: 'refactor the module' });

    // Set up: questions + answers
    const engine = new SocratesEngine();
    const questions = engine.analyze({
      changeId: id,
      proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
      snippetsDir: `changes/${id}/snippets`,
    });
    const store = clarifyStore(id);
    store.questions.replace(questions);
    const ans: Answer = { questionId: questions[0].id, text: 'Will extract', ts: new Date().toISOString() };
    store.answers.replace([ans]);
    store.dialogue.replace([{ role: 'agent', text: 'Will extract', ts: new Date().toISOString() }]);

    // Refine
    refine(id);

    // Read proposal
    const { readFileSync: readFs } = await import('node:fs');
    const raw = JSON.parse(readFs(`changes/${id}/proposal.json`, 'utf8'));
    expect(raw.answers).toBeDefined();
    expect(raw.answers.length).toBeGreaterThanOrEqual(1);
    expect(raw.context).toBeDefined();
    expect(raw.context).toContain('refactor');
  });
});

it('refine auto returns blocker message when blockers remain', () => {
  const id = 'test-refine-auto-blocked';
  createChangeDir(id);
  writeProposal(id, { goal: 'refactor the module' });

  const engine = new SocratesEngine();
  const questions = engine.analyze({
    changeId: id,
    proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
    snippetsDir: 'changes/' + id + '/snippets',
  });
  const store = clarifyStore(id);
  store.questions.replace(questions);

  const result = refine(id, true);
  expect(result).not.toBeNull();
  expect(result).toContain('blocker');
});

it('refine auto returns null when all blockers resolved', () => {
  const id = 'test-refine-auto-pass';
  createChangeDir(id);
  writeProposal(id, { goal: 'refactor the module' });

  const engine = new SocratesEngine();
  const questions = engine.analyze({
    changeId: id,
    proposal: { title: id, goal: 'refactor the module', platform: '', constraints: '', budget: '' },
    snippetsDir: 'changes/' + id + '/snippets',
  });
  const store = clarifyStore(id);
  store.questions.replace(questions);

  const answers = questions
    .filter(q => q.priority === 'blocker')
    .map(q => ({ questionId: q.id, text: 'acknowledged', ts: new Date().toISOString() }));
  store.answers.replace(answers);
  const dialogs = answers.map((a: Answer) => ({ role: 'agent' as const, text: a.text, ts: a.ts }));
  store.dialogue.replace(dialogs);

  const result = refine(id, true);
  expect(result).toBeNull();
});
