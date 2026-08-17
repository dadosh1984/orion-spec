/**
 * SocratesEngine — rule-based clarifying question generator (v0.58).
 *
 * Deterministic, zero LLM calls. Analyzes proposal, snippets, hazards,
 * drift and test coverage to produce meaningful questions.
 */

import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { scanHazards } from "./hazards.js";
import type { Proposal } from "../type.js";
import { clarifyStore } from "./clarifyStore.js";

export type QuestionCategory =
  "hazard" | "ambiguity" | "incomplete" | "drift" | "test";
export type QuestionPriority = "blocker" | "clarifying";

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
  role: "orion" | "agent";
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

const TODO_PATTERNS = /TODO|FIXME|XXX|HACK/;

/**
 * Write JSON to a file using write+rename atomic pattern.
 * Same contract as writeFileSafe in utils/file.ts but sync.
 */
function writeJson(file: string, obj: unknown): void {
  const content = JSON.stringify(obj, null, 2);
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content, "utf8");
  try {
    renameSync(tmp, file);
  } catch {
    // Fallback: rename can fail cross-device; write directly
    writeFileSync(file, content, "utf8");
  }
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

export interface UnansweredBlocker {
  id: string;
  text: string;
}

export class SocratesEngine {
  private idCounter = 0;

  private nextId(prefix: string): string {
    this.idCounter++;
    return `soc-${prefix}-${this.idCounter}`;
  }

  /** Generate questions deterministically from the given context. */
  analyze(opts: AnalyzeOpts): Question[] {
    this.idCounter = 0;
    const generated: Question[] = [];

    // Build set of (source,text) from existing questions to avoid regenerating (fix #4)
    const existingKeySet = new Set(
      (opts.existingQuestions ?? []).map((q) => `${q.source}::${q.text}`),
    );

    // 1. HAZARD → blocker
    this.addRule(generated, existingKeySet, () => {
      const hazards = this.detectHazards(opts);
      if (hazards.length > 0) {
        return {
          id: this.nextId("haz"),
          text: `Hazard detected: ${hazards.join("; ")}. Confirm these destructive operations are intentional.`,
          category: "hazard" as QuestionCategory,
          priority: "blocker" as QuestionPriority,
          source: "hazard:scan",
          resolved: false,
          ts: now(),
        };
      }
      return null;
    });

    // 3. INCOMPLETE → clarifying (per file with TODO)
    this.addRule(generated, existingKeySet, () => {
      const todos = this.detectTodos(opts);
      const qs: Question[] = [];
      for (const file of todos) {
        qs.push({
          id: this.nextId("inc"),
          text: `Snippet "${file}" contains TODO/FIXME. What remains to be done?`,
          category: "incomplete" as QuestionCategory,
          priority: "clarifying" as QuestionPriority,
          source: `snippet:${file}`,
          resolved: false,
          ts: now(),
        });
      }
      return qs;
    });

    // 4. DRIFT → clarifying
    this.addRule(generated, existingKeySet, () => {
      const driftItems = this.detectDrift(opts);
      if (driftItems.length > 0) {
        return [
          {
            id: this.nextId("drf"),
            text: `Spec-to-source drift detected (${driftItems.length} items). Is this deviation intentional?`,
            category: "drift" as QuestionCategory,
            priority: "clarifying" as QuestionPriority,
            source: "drift:review",
            resolved: false,
            ts: now(),
          },
        ];
      }
      return [];
    });

    // 5. TEST → clarifying
    this.addRule(generated, existingKeySet, () => {
      const missingTest = this.detectMissingTests(opts);
      if (missingTest) {
        return [
          {
            id: this.nextId("tst"),
            text: "New code detected (export/function) but no test files found. Are tests planned?",
            category: "test" as QuestionCategory,
            priority: "clarifying" as QuestionPriority,
            source: "test:coverage",
            resolved: false,
            ts: now(),
          },
        ];
      }
      return [];
    });

    return generated;
  }

  /** Dedup by (source, text) tuple against existing and within one analyze call. */
  private addRule(
    generated: Question[],
    existingKeySet: Set<string>,
    fn: () => Question | Question[] | null,
  ): void {
    const result = fn();
    if (result === null) return;
    const items = Array.isArray(result) ? result : [result];
    for (const q of items) {
      const key = `${q.source}::${q.text}`;
      // Skip if already in existing questions or already generated in this call
      if (
        existingKeySet.has(key) ||
        generated.find((g) => `${g.source}::${g.text}` === key)
      ) {
        continue;
      }
      generated.push(q);
    }
  }

  private detectHazards(opts: AnalyzeOpts): string[] {
    const snippetsDir = opts.snippetsDir;
    if (!snippetsDir || !existsSync(snippetsDir)) return [];

    const hazards: string[] = [];
    const files = this.listFiles(snippetsDir, ".ts");
    for (const f of files) {
      try {
        const code = readFileSync(f, "utf8");
        const found = scanHazards(code);
        if (found.length > 0) {
          hazards.push(...found.map((h) => `${f}: ${h}`));
        }
      } catch {
        // skip unreadable
      }
    }
    return hazards;
  }
  private detectTodos(opts: AnalyzeOpts): string[] {
    const snippetsDir = opts.snippetsDir;
    if (!snippetsDir || !existsSync(snippetsDir)) return [];

    const filesWithTodos: string[] = [];
    const files = this.listFiles(snippetsDir, ".ts");
    for (const f of files) {
      try {
        const code = readFileSync(f, "utf8");
        if (TODO_PATTERNS.test(code)) {
          filesWithTodos.push(f.replace(/\\/g, "/"));
        }
      } catch {
        // skip
      }
    }
    return filesWithTodos.sort();
  }

  private detectDrift(opts: AnalyzeOpts): string[] {
    const changeDir = join(process.cwd(), "changes", opts.changeId);
    const specsDir = join(changeDir, "specs");
    if (!existsSync(specsDir)) return [];

    const driftItems: string[] = [];
    const specDirs = readdirSync(specsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const specDir of specDirs) {
      const specFile = join(specsDir, specDir, "spec.md");
      if (!existsSync(specFile)) continue;
      const specContent = readFileSync(specFile, "utf8");

      // Extract code blocks (```typescript ... ```) and inline backticks
      const codeBlocks: string[] = [];
      const blockRegex = /```(?:typescript|ts)?\n([\s\S]*?)```/g;
      let m: RegExpExecArray | null;
      while ((m = blockRegex.exec(specContent)) !== null) {
        codeBlocks.push(m[1]);
      }
      const codeText = codeBlocks.join("\n") + "\n" + specContent;

      const exports = codeText.match(
        /`?export\s+(function|const|class|interface|type)\s+(\w+)/g,
      );
      if (!exports) continue;
      for (const exp of exports) {
        const name = exp.split(/\s+/).pop() ?? "";
        const srcFile = join(opts.srcDir ?? "src", `${name}.ts`);
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

    const files = this.listFiles(snippetsDir, ".ts");
    if (files.length === 0) return false;

    let hasNewCode = false;
    for (const f of files) {
      try {
        const code = readFileSync(f, "utf8");
        if (/export\s|function\s/.test(code)) {
          hasNewCode = true;
          break;
        }
      } catch {
        // skip
      }
    }
    if (!hasNewCode) return false;

    // Check change-level tests/ directory
    const changeDir = join(process.cwd(), "changes", opts.changeId);
    const changeTestDir = join(changeDir, "tests");
    if (
      existsSync(changeTestDir) &&
      this.listFiles(changeTestDir, ".test.ts").length > 0
    )
      return false;

    // Check project-level tests/ directory
    const testDir = join(process.cwd(), "tests");
    if (existsSync(testDir) && this.listFiles(testDir, ".test.ts").length > 0)
      return false;

    // Check .test.ts / .spec.ts in snippets
    const snippetTestFiles = files.filter(
      (f) => f.includes(".test.") || f.includes(".spec."),
    );
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

  const engine = new SocratesEngine();
  const newQuestions = engine.analyze({
    changeId,
    proposal,
    snippetsDir: existsSync(snippetsDir) ? snippetsDir : null,
    srcDir: "src",
    existingQuestions: state.questions,
    existingAnswers: state.answers,
  });

  // Dedup by (source, text) against existing persisted questions
  const existingKeys = new Set(
    state.questions.map((q) => `${q.source}::${q.text}`),
  );
  const questions = newQuestions.filter(
    (q) => !existingKeys.has(`${q.source}::${q.text}`),
  );

  // Merge with existing and save
  const allQuestions = [...state.questions, ...questions];
  store.questions.replace(allQuestions);
  return allQuestions;
}

export function getUnansweredBlockers(changeId: string): UnansweredBlocker[] {
  try {
    const state = loadClarifyState(changeId);
    const answeredIds = new Set(state.answers.map((a) => a.questionId));
    return state.questions
      .filter((q) => q.priority === "blocker" && !answeredIds.has(q.id))
      .map((q) => ({ id: q.id, text: q.text }));
  } catch {
    return [];
  }
}

export function applyAnswers(changeId: string, answers: Answer[]): void {
  const store = clarifyStore(changeId);
  const state = loadClarifyState(changeId);

  for (const answer of answers) {
    const q = state.questions.find((q) => q.id === answer.questionId);
    if (q) q.resolved = true;

    const existing = state.answers.find(
      (a) => a.questionId === answer.questionId,
    );
    if (existing) {
      existing.text = answer.text;
      existing.ts = answer.ts;
    } else {
      state.answers.push(answer);
    }

    state.dialogue.push({
      role: "agent",
      text: answer.text,
      ts: answer.ts ?? now(),
    });
  }

  store.questions.replace(state.questions);
  store.answers.replace(state.answers);
  store.dialogue.replace(state.dialogue);
}

export function hasUnansweredBlockers(changeId: string): boolean {
  const state = loadClarifyState(changeId);
  const answeredIds = new Set(state.answers.map((a) => a.questionId));
  return state.questions.some(
    (q) => q.priority === "blocker" && !answeredIds.has(q.id),
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

  // Write proposal.json atomically (fix #2)
  writeJson(`changes/${changeId}/proposal.json`, proposal);

  // Log in dialogue
  appendDialogue(changeId, {
    role: "orion",
    text: "Context updated via answers. Re-run orion forge <change-id> to apply.",
    ts: now(),
  });

  // --auto: check blockers after merge
  if (autoCheck) {
    const blockers = getUnansweredBlockers(changeId);
    if (blockers.length > 0) {
      const msg = `${blockers.length} blocker(s) remain after answers: ${blockers.map((b) => b.id).join(", ")}`;
      appendDialogue(changeId, {
        role: "orion",
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
  return parts.join(" | ");
}

/** Read and parse JSON synchronously (needed for clarify which runs sync). */
function readJsonSync<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}
