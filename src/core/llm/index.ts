/**
 * LLM module index (v0.61).
 *
 * Auto-detects available LLM backend. Falls back to rule-based defaults
 * when no backend is configured or reachable.
 */

import type { LlmAdapter } from "./adapter.js";
import { defaultAnswer } from "./prompts.js";
import { ollamaAdapter } from "./ollama.js";
import type { Question } from "../clarify.js";

export type { LlmAdapter, LlmResult } from "./adapter.js";

let _adapter: LlmAdapter | null = null;
let _pinged = false;
let _available = false;

/** Detect and cache the available LLM backend. */
export async function detectAdapter(): Promise<LlmAdapter | null> {
  if (_adapter) return _adapter;
  if (_pinged) return _available ? _adapter : null;

  _pinged = true;

  // Try Ollama first (local, zero config)
  const ollama = ollamaAdapter();
  try {
    const ok = await ollama.ping();
    if (ok) {
      _adapter = ollama;
      _available = true;
      return _adapter;
    }
  } catch {
    // Ollama not available
  }

  return null;
}

/** Ask the LLM a question, or fall back to rule-based default. */
export async function askWithFallback(
  question: Question,
  proposalGoal: string,
  existingContext: string,
): Promise<string> {
  const adapter = await detectAdapter();

  if (adapter) {
    const result = await adapter.ask(
      question.text,
      `${proposalGoal}\n${existingContext}`,
    );
    if (result.ok && result.text) {
      return result.text;
    }
  }

  // Fallback: rule-based default
  return defaultAnswer(question.text, question.category);
}
