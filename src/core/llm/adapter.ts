/**
 * LLM adapter interface for external language models (v0.61).
 *
 * Zero runtime dependencies. Core stays clean — the adapter module
 * is imported dynamically when needed, never at startup.
 */

/** Result of an LLM call. */
export interface LlmResult {
  ok: boolean;
  text: string;
  error?: string;
}

/** Generic adapter for any LLM backend (Ollama, OpenAI, local). */
export interface LlmAdapter {
  /** Ask a question with context, get a text answer back. */
  ask(question: string, context: string): Promise<LlmResult>;
  /** Check whether the backend is reachable. */
  ping(): Promise<boolean>;
  /** Human-readable name, e.g. "Ollama (llama3.2)". */
  readonly name: string;
}
