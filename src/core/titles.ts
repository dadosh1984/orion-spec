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
// Memo key -> cached words (v0.29, T5.2): shortTitle/shortSlug call this
// repeatedly on identical prompts; a pure function deserves a cache. Bounded.
const SW_CACHE = new Map<string, string[]>();
const SW_CACHE_MAX = 512;
export function significantWords(text: string, max: number): string[] {
  const key = `${text.length}|${max}|${text}`;
  const hit = SW_CACHE.get(key);
  if (hit) return hit;
  const words: string[] = [];
  for (const w of text.toLowerCase().split(/[^a-z0-9а-яё]+/)) {
    if (!w || TITLE_STOPWORDS.has(w)) continue;
    words.push(w);
    if (words.length >= max) break;
  }
  if (SW_CACHE.size >= SW_CACHE_MAX) SW_CACHE.clear();
  SW_CACHE.set(key, words);
  return words;
}
