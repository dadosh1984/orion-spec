/**
 * Ollama LLM adapter (v0.61).
 *
 * Uses Node.js built-in fetch (available since Node 18) to talk to
 * a local Ollama instance. Zero runtime dependencies.
 *
 * Env vars:
 *   ORION_LLM_URL     default http://127.0.0.1:11434
 *   ORION_LLM_MODEL   default llama3.2
 */

import type { LlmAdapter } from "./adapter.js";

const DEFAULT_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2";

interface OllamaResponse {
  response?: string;
  done?: boolean;
  error?: string;
}

function baseUrl(): string {
  return process.env.ORION_LLM_URL ?? DEFAULT_URL;
}

function model(): string {
  return process.env.ORION_LLM_MODEL ?? DEFAULT_MODEL;
}

/** Create an Ollama adapter. Fails gracefully if Ollama is not running. */
export function ollamaAdapter(): LlmAdapter {
  return {
    name: `Ollama (${model()})`,

    async ask(
      question: string,
      context: string,
    ): Promise<{ ok: boolean; text: string; error?: string }> {
      const url = `${baseUrl()}/api/generate`;
      const prompt = [
        context ? `Context: ${context}` : "",
        `Question: ${question}`,
        "",
        "Answer concisely in 1-2 sentences:",
      ]
        .filter((l) => l)
        .join("\n");

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model(),
            prompt,
            stream: false,
            options: {
              temperature: 0.3,
              num_predict: 128,
            },
          }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
          return {
            ok: false,
            text: "",
            error: `Ollama returned ${res.status}: ${res.statusText}`,
          };
        }

        const data = (await res.json()) as OllamaResponse;
        if (data.error) {
          return { ok: false, text: "", error: data.error };
        }

        return { ok: true, text: (data.response ?? "").trim() };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, text: "", error: msg };
      }
    },

    async ping(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl()}/api/tags`, {
          signal: AbortSignal.timeout(3_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
