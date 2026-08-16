/**
 * SocratesEngine — rule-based clarifying question generator (v0.58).
 *
 * Deterministic, zero LLM calls. Analyzes proposal, snippets, hazards,
 * drift and test coverage to produce meaningful questions.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { scanHazards } from './hazards.js';
import type { Proposal } from '../type.js';
import { clarifyStore } from './clarifyStore.js';

export type QuestionCategory = 'hazard' | 'ambiguity' | 'incomplete' | 'drift' | 'test';
export type QuestionPriority = 'blocker' | 'clarifying';

export interface Question {
  id: string;
  text: string;
  category: QuestionCategory;
  priority: QuestionPriority;
  source: string;
  resolved: boolean;
  ts: string;
}

export interface Answer {
  questionId: string;
  text: string;
  ts: string;
}

export interface DialogueEntry {
  role: 'orion' | 'agent';
  text: string;
  ts: string;
}

export interface ClarifyState {
  changeId: string;
  questions: Question[];
  answers: Answer[];
  dialogue: DialogueEntry[];
}

function now(): string {
  return new Date().toISOString();
}

const VAGUE_TERMS = [
  'улучшить', 'оптимизировать', 'рефакторинг', 'сделать лучше',
  'пофиксить', 'доработать', 'обновить', 'enhance', 'optimize',
  'refactor', 'improve', 'fix', 'update',
];

// Counter for deterministic question ids
let idCounter = 0;
function nextId(prefix: string): string {
  idCounter++;
  return `soc-${prefix}-${idCounter}`;
}

export interface AnalyzeOpts {
  changeId: string;
  proposal: Proposal | null;
  /** Snippet directory path (changes/<id>/snippets/ or null) */
  snippetsDir?: string | null;
  /** Source directory for drift detection */
  srcDir?: string;
  /** Existing questions to avoid duplicates */
  existingQuestions?: Question[];
  /** Existing answers (paired with questions) */
  existingAnswers?: Answer[];
}

const TODO_PATTERNS = /TODO|FIXME|XXX|HACK/;

export class SocratesEngine {
  /** Generate questions deterministically from the given context. */
  analyze(opts: AnalyzeOpts): Question[] {
    const generated: Question[] = [];
    const existingMap = new Map(
      (opts.existingQuestions ?? []).map(q => [q.id, q]),
    );
    const answeredQuestionIds = new Set(
      (opts.existingAnswers ?? []).map(a => a.questionId),
    );

    // 1. HAZARD → blocker
    this.addRule(generated, 'hazard-blocker', existingMap, answeredQuestionIds, () => {
      const hazards = this.detectHazards(opts);
      if (hazards.length > 0) {
        return {
          id: nextId('haz'),
          text: `Hazard detected: ${hazards.join('; ')}. Confirm these destructive operations are intentional.`,
          category: 'hazard' as QuestionCategory,
          priority: 'blocker' as QuestionPriority,
          source: 'hazard:scan',
          resolved: false,
          ts: now(),
        };
      }
      return null;
    });

    // 2. AMBIGUITY → blocker
    this.addRule(generated, 'ambiguity-blocker', existingMap, answeredQuestionIds, () => {
      const vague = this.detectAmbiguity(opts);
      if (vague) {
        return {
          id: nextId('amb'),
          text: `Goal "${opts.proposal?.goal ?? '?'}" contains vague term(s): "${vague}". Provide concrete completion criteria.`,
          category: 'ambiguity' as QuestionCategory,
          priority: 'blocker' as QuestionPriority,
          source: 'proposal:goal',
          resolved: false,
          ts: now(),
        };
      }
      return null;
    });

    // 3. INCOMPLETE → clarifying (per file with TODO)
    this.addRule(generated, 'incomplete-clarifying', existingMap, answeredQuestionIds, () => {
      const todos = this.detectTodos(opts);
      // One question per file
      const qs: Question[] = [];
      for (const file of todos) {
        qs.push({
          id: nextId('inc'),
          text: `Snippet "${file}" contains TODO/FIXME. What remains to be done?`,
          category: 'incomplete' as QuestionCategory,
          priority: 'clarifying' as QuestionPriority,
          source: `snippet:${file}`,
          resolved: false,
          ts: now(),
        });
      }
      return qs;
    });

    // 4. DRIFT → clarifying
    this.addRule(generated, 'drift-clarifying', existingMap, answeredQuestionIds, () => {
      const driftItems = this.detectDrift(opts);
      if (driftItems.length > 0) {
        return [{
          id: nextId('drf'),
          text: `Spec-to-source drift detected (${driftItems.length} items). Is this deviation intentional?`,
          category: 'drift' as QuestionCategory,
          priority: 'clarifying' as QuestionPriority,
          source: 'drift:review',
          resolved: false,
          ts: now(),
        }];
      }
      return [];
    });

    // 5. TEST → clarifying
    this.addRule(generated, 'test-clarifying', existingMap, answeredQuestionIds, () => {
      const missingTest = this.detectMissingTests(opts);
      if (missingTest) {
        return [{
          id: nextId('tst'),
          text: 'New code detected (export/function) but no test files found. Are tests planned?',
          category: 'test' as QuestionCategory,
          priority: 'clarifying' as QuestionPriority,
          source: 'test:coverage',
          resolved: false,
          ts: now(),
        }];
      }
      return [];
    });

    return generated;
  }

  /** Helper: if rule produces non-null, check dedup before adding. */
  private addRule(
    generated: Question[],
    ruleKey: string,
    existingMap: Map<string, Question>,
    answeredIds: Set<string>,
    fn: () => Question | Question[] | null,
  ): void {
    const result = fn();
    if (result === null) return;
    const items = Array.isArray(result) ? result : [result];
    for (const q of items) {
      // Dedup: if same text exists AND is already answered, skip
      const dup = this.findDuplicate(q, existingMap, answeredIds);
      if (!dup) {
        generated.push(q);
      }
    }
  }

  private findDuplicate(
    q: Question,
    existingMap: Map<string, Question>,
    answeredIds: Set<string>,
  ): Question | undefined {
    // Check by source + text (same context = same question)
    for (const existing of existingMap.values()) {
      if (
        existing.source === q.source &&
        existing.text === q.text &&
        answeredIds.has(existing.id)
      ) {
        return existing;
      }
    }
    return undefined;
  }

  private detectHazards(opts: AnalyzeOpts): string[] {
    // Scan snippet files for hazard patterns
    const snippetsDir = opts.snippetsDir;
    if (!snippetsDir || !existsSync(snippetsDir)) return [];

    const hazards: string[] = [];
    const files = this.listFiles(snippetsDir, '.ts');
    for (const f of files) {
      try {
        const code = readFileSync(f, 'utf8');
        const found = scanHazards(code);
        if (found.length > 0) {
          hazards.push(...found.map(h => `${f}: ${h}`));
        }
      } catch {
        // skip unreadable
      }
    }
    return hazards;
  }

  private detectAmbiguity(opts: AnalyzeOpts): string | null {
    const goal = opts.proposal?.goal ?? '';
    if (!goal) return null;
    const lower = goal.toLowerCase();
    for (const term of VAGUE_TERMS) {
      if (lower.includes(term)) return term;
    }
    return null;
  }

  private detectTodos(opts: AnalyzeOpts): string[] {
    const snippetsDir = opts.snippetsDir;
    if (!snippetsDir || !existsSync(snippetsDir)) return [];

    const filesWithTodos: string[] = [];
    const files = this.listFiles(snippetsDir, '.ts');
    for (const f of files) {
      try {
        const code = readFileSync(f, 'utf8');
        if (TODO_PATTERNS.test(code)) {
          filesWithTodos.push(f.replace(/\\/g, '/'));
        }
      } catch {
        // skip
      }
    }
    return filesWithTodos.sort();
  }

  private detectDrift(opts: AnalyzeOpts): string[] {
    // MVP: check spec files exist and have matching source files
    const changeDir = join(process.cwd(), 'changes', opts.changeId);
    const specsDir = join(changeDir, 'specs');
    if (!existsSync(specsDir)) return [];

    const driftItems: string[] = [];
    const specDirs = readdirSync(specsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const specDir of specDirs) {
      const specFile = join(specsDir, specDir, 'spec.md');
      if (!existsSync(specFile)) continue;
      const specContent = readFileSync(specFile, 'utf8');
      // Check exported symbols mentioned in spec exist in src
      const exports = specContent.match(/`export\s+(function|const|class|interface|type)\s+(\w+)/g);
      if (!exports) continue;
      for (const exp of exports) {
        const name = exp.split(/\s+/).pop() ?? '';
        // Check if a file with this name exists
        const srcFile = join(opts.srcDir ?? 'src', `${name}.ts`);
        if (!existsSync(srcFile)) {
          driftItems.push(`${name} (spec: expected in src/${name}.ts)`);
        }
      }
    }
    return driftItems;
  }

  private detectMissingTests(opts: AnalyzeOpts): boolean {
    const snippetsDir = opts.snippetsDir;
    if (!snippetsDir || !existsSync(snippetsDir)) return false;

    const files = this.listFiles(snippetsDir, '.ts');
    if (files.length === 0) return false;

    // Check if there's at least one code file with export/function
    let hasNewCode = false;
    for (const f of files) {
      try {
        const code = readFileSync(f, 'utf8');
        if (/export\s|function\s/.test(code)) {
          hasNewCode = true;
          break;
        }
      } catch {
        // skip
      }
    }
    if (!hasNewCode) return false;

    // Check for test files
    const testDir = join(process.cwd(), 'tests');
    if (!existsSync(testDir)) return true;
    const testFiles = this.listFiles(testDir, '.test.ts');
    if (testFiles.length === 0) return true;

    // Also check snippet dir for test files
    const snippetTestFiles = files.filter(f => f.includes('.test.') || f.includes('.spec.'));
    return snippetTestFiles.length === 0;
  }

  private listFiles(dir: string, ext: string): string[] {
    const results: string[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.listFiles(full, ext));
        } else if (entry.name.endsWith(ext)) {
          results.push(full);
        }
      }
    } catch {
      // skip unreadable
    }
    return results.sort();
  }
}

// === High-level helpers ===

export function generateQuestions(changeId: string): Question[] {
  const store = clarifyStore(changeId);
  const state = loadClarifyState(changeId);
  const proposal = readJsonSync<Proposal>(`changes/${changeId}/proposal.json`);
  const snippetsDir = `changes/${changeId}/snippets`;

  // Avoid duplicating already-asked questions
  const existingIds = new Set(state.questions.map(q => q.id));

  const engine = new SocratesEngine();
  const newQuestions = engine.analyze({
    changeId,
    proposal,
    snippetsDir: existsSync(snippetsDir) ? snippetsDir : null,
    srcDir: 'src',
    existingQuestions: state.questions,
    existingAnswers: state.answers,
  });

  // Filter out questions that were already persisted (even if unanswered)
  const questions = newQuestions.filter(q => !existingIds.has(q.id));

  // Merge with existing and save
  const allQuestions = [...state.questions, ...questions];
  store.questions.replace(allQuestions);
  return allQuestions;
}

export function applyAnswers(changeId: string, answers: Answer[]): void {
  const store = clarifyStore(changeId);
  const state = loadClarifyState(changeId);

  for (const answer of answers) {
    // Mark resolved on matching question
    const q = state.questions.find(q => q.id === answer.questionId);
    if (q) q.resolved = true;

    // Append to answers (avoid dups by questionId)
    const existing = state.answers.find(a => a.questionId === answer.questionId);
    if (existing) {
      existing.text = answer.text;
      existing.ts = answer.ts;
    } else {
      state.answers.push(answer);
    }

    // Append to dialogue
    state.dialogue.push({ role: 'agent', text: answer.text, ts: answer.ts });
  }

  // Persist
  store.questions.replace(state.questions);
  store.answers.replace(state.answers);
  store.dialogue.replace(state.dialogue);
}

export function hasUnansweredBlockers(changeId: string): boolean {
  const state = loadClarifyState(changeId);
  const answeredIds = new Set(state.answers.map(a => a.questionId));
  return state.questions.some(
    q => q.priority === 'blocker' && !answeredIds.has(q.id),
  );
}

export function loadClarifyState(changeId: string): ClarifyState {
  const store = clarifyStore(changeId);
  return {
    changeId,
    questions: store.questions.load(),
    answers: store.answers.load(),
    dialogue: store.dialogue.load(),
  };
}

export function appendDialogue(changeId: string, entry: DialogueEntry): void {
  const store = clarifyStore(changeId);
  const state = loadClarifyState(changeId);
  state.dialogue.push(entry);
  store.dialogue.replace(state.dialogue);
}

export function refine(changeId: string, autoCheck = false): string | null {
  const proposal = readJsonSync<Proposal>(`changes/${changeId}/proposal.json`);
  if (!proposal) {
    throw new Error(`change "${changeId}" has no proposal.json`);
  }
  const state = loadClarifyState(changeId);

  // Append answers to proposal
  proposal.answers = [...(proposal.answers ?? []), ...state.answers];
  // Build context string
  proposal.context = buildContext(proposal.goal, state.answers);

  // Write proposal back synchronously
  writeFileSync(`changes/${changeId}/proposal.json`, JSON.stringify(proposal, null, 2), 'utf8');

  // Log in dialogue
  appendDialogue(changeId, {
    role: 'orion',
    text: 'Context updated via answers. Re-run orion forge <change-id> to apply.',
    ts: now(),
  });

  // --auto: check blockers after merge
  if (autoCheck) {
    const blockers = getUnansweredBlockersSync(changeId);
    if (blockers.length > 0) {
      const msg = `${blockers.length} blocker(s) remain after answers: ${blockers.map(b => b.id).join(', ')}`;
      appendDialogue(changeId, {
        role: 'orion',
        text: msg,
        ts: now(),
      });
      return msg;
    }
  }

  return null;
}

function buildContext(goal: string, answers: Answer[]): string {
  const parts: string[] = [goal];
  for (const a of answers) {
    parts.push(`${a.questionId}: ${a.text}`);
  }
  return parts.join(' | ');
}

/** Sync helper for refine --auto: check blockers without loading state twice. */
function getUnansweredBlockersSync(changeId: string): Array<{ id: string; text: string }> {
  try {
    const state = loadClarifyState(changeId);
    const answeredIds = new Set(state.answers.map(a => a.questionId));
    return state.questions
      .filter(q => q.priority === 'blocker' && !answeredIds.has(q.id))
      .map(q => ({ id: q.id, text: q.text }));
  } catch {
    return [];
  }
}

/** Read and parse JSON synchronously (needed for clarify which runs sync). */
function readJsonSync<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}
