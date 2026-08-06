/**
 * Prompt refinement for `orion think`.
 *
 * Users phrase ideas with very different lexicons; some ideas arrive as
 * fragments. These helpers normalize the raw input, assess how actionable
 * it is, and produce clarifying questions — all mechanically, no model.
 * The refined goal then flows into draft, tasks and specs.
 */

export type PromptLanguage = "en" | "ru";
export type Clarity = "clear" | "vague";

export interface PromptAssessment {
  clarity: Clarity;
  language: PromptLanguage;
  words: number;
  /** What the prompt is missing to be actionable. */
  missing: Array<"action" | "object" | "detail">;
}

const EN_ACTIONS =
  /(build|make|create|implement|add|fix|refactor|analyze|convert|parse|write|design|develop|improve|scan|check|test|support|enable|integrate|migrate|generate)\b/i;
const RU_ACTIONS =
  /(сделать|создать|написать|построить|добавить|исправить|починить|реализовать|разработать|улучшить|проверить|проанализировать|перевести|конвертировать|собрать|настроить|интегрировать|перенести|сгенерировать)\b/i;

/** Collapse whitespace, trim, drop surrounding punctuation noise. */
export function normalizePrompt(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Detect the prompt language (ru if any Cyrillic, otherwise en). */
export function detectLanguage(prompt: string): PromptLanguage {
  return /[а-яё]/i.test(prompt) ? "ru" : "en";
}

/** Assess how actionable a prompt is. */
export function assessPrompt(prompt: string): PromptAssessment {
  const language = detectLanguage(prompt);
  const words = prompt.split(/\s+/).filter(Boolean).length;
  const hasAction =
    language === "ru" ? RU_ACTIONS.test(prompt) : EN_ACTIONS.test(prompt);

  const missing: Array<"action" | "object" | "detail"> = [];
  if (!hasAction) missing.push("action");
  // Too little detail to pin down a deliverable.
  if (words < 4) missing.push("detail");
  // A verb with no following content is just a heading ("build", "fix").
  if (hasAction && words < 3) missing.push("object");

  return {
    clarity: missing.length === 0 ? "clear" : "vague",
    language,
    words,
    missing,
  };
}

/** Clarifying questions in the prompt's own language. */
export function clarifyingQuestions(
  assessment: PromptAssessment,
): Array<{ msg: string; key: "action" | "object" | "detail" }> {
  const ru = assessment.language === "ru";
  const out: Array<{ msg: string; key: "action" | "object" | "detail" }> = [];
  // Never flood the user — at most two clarifying questions, in priority
  // order (action > detail > object). The guided questions follow anyway.
  for (const k of assessment.missing.slice(0, 2)) {
    const msg =
      k === "action"
        ? ru
          ? "Что именно нужно сделать? (например: создать, исправить, проанализировать…) "
          : "What exactly needs to be done? (build, fix, analyze…) "
        : k === "object"
          ? ru
            ? "Над чем? Что это должно делать или улучшать? "
            : "About what? What should it do or improve? "
          : ru
            ? "Сформулируй идею одним предложением: "
            : "Sum the idea up in one sentence: ";
    out.push({ msg, key: k });
  }
  return out;
}

/**
 * Compose the final goal from the raw prompt plus any clarification
 * answers. Prefers a concrete user rephrase when given.
 */
export function composeGoal(raw: string, answers: string[]): string {
  const concrete = answers.filter((a) => a.trim().split(/\s+/).length >= 3);
  if (concrete.length === 0) return raw;
  const joined = concrete
    .map((a) => a.trim())
    .join(". ")
    .replace(/\.+$/, "");
  return joined.length >= raw.length ? joined : `${raw} — ${joined}`;
}
