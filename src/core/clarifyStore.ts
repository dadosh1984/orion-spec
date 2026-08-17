/**
 * Store-backed persistence for SocratesEngine state (v0.58).
 *
 * Three separate fileStore instances: questions.json, answers.json, dialogue.json
 * All I/O goes through Store<T> — no raw readFileSync/writeFileSync.
 */

import { join } from "node:path";
import { fileStore, type Store } from "./store.js";
import type { Question, Answer, DialogueEntry } from "./clarify.js";

export interface ClarifyStoreSet {
  questions: Store<Question>;
  answers: Store<Answer>;
  dialogue: Store<DialogueEntry>;
}

/** Create a set of stores for a given change id. */
export function clarifyStore(changeId: string): ClarifyStoreSet {
  const dir = join(process.cwd(), "changes", changeId);
  return {
    questions: fileStore<Question>(join(dir, "questions.json")),
    answers: fileStore<Answer>(join(dir, "answers.json")),
    dialogue: fileStore<DialogueEntry>(join(dir, "dialogue.json")),
  };
}
