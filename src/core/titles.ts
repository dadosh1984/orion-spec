/**
 * Shared short-name machinery (v0.24) — the single source of truth for
 * "significant word" derivation used by two callers:
 *
 *  - change titles (`think`'s `shortTitle`): 3–4 significant words;
 *  - task snippet slugs (`forge`'s `shortSlug`): 2–3 significant words,
 *    identifier-safe, unique within a change.
 *
 * Latin **and** Cyrillic are supported (Russian prompts must not degrade to
 * "untitled"), deterministic, zero dependencies.
 */

/** Grammatical stopwords (EN + RU) — never significant in a name. */
export const TITLE_STOPWORDS: ReadonlySet<string> = new Set([
  "the",
  "a",
  "an",
  "in",
  "of",
  "for",
  "to",
  "with",
  "on",
  "at",
  "by",
  "and",
  "or",
  "so",
  "is",
  "it",
  "as",
  "that",
  "this",
  "from",
  "into",
  "via",
  "по",
  "в",
  "на",
  "и",
  "с",
  "для",
  "из",
  "о",
  "об",
  "что",
  "это",
  "как",
  "при",
  "от",
  "до",
  "за",
  "не",
  "но",
  "если",
  "чтобы",
  "уже",
  "еще",
  "также",
  "только",
  "который",
  "которая",
  "которые",
  "его",
  "ее",
  "их",
  "будет",
  "быть",
  "были",
  "все",
  "свой",
  "своя",
  "свои",
]);

/** First `max` significant words of a phrase (stopwords stripped). */
export function significantWords(text: string, max: number): string[] {
  const words: string[] = [];
  for (const w of text.toLowerCase().split(/[^a-z0-9а-яё]+/)) {
    if (!w || TITLE_STOPWORDS.has(w)) continue;
    words.push(w);
    if (words.length >= max) break;
  }
  return words;
}
