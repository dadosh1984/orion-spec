/**
 * Prompt complexity classifier (v0.51).
 *
 * Strategy: «eat an elephant in small bites». Before any work starts,
 * classify the prompt into one of four bands and derive the target
 * decomposition depth.
 *
 *   abstract  — question/exploration, not a deliverable       (depth 0)
 *   easy      — 1 action, 1 entity; ~2-3 real steps           (depth 1)
 *   medium    — 2-3 actions, several entities; ~6-8 steps     (depth 2)
 *   hard      — many entities / system-scale; ~12+ steps      (depth 3)
 *
 * The tree shape (2 branches per level) gives these step budgets:
 *   depth 1 → 2 big steps
 *   depth 2 → 6 (2 big + 4 medium)
 *   depth 3 → 14 (2 big + 4 medium + 8 small)
 * Depth 4 (30 micro-steps) is reserved for the reactive fallback in
 * `forge` when a task fails twice — not planned here.
 *
 * The method is deterministic signal-counting — no LLM, in the spirit
 * of `assessPrompt` (zero-dependency, reproducible, honest).
 *
 * Counted signals:
 *   - action verbs (build/fix/refactor/...) — intent density
 *   - coordination conjunctions (and/then/also/...) — compound intent
 *   - entity markers (file paths, quoted names, code in backticks)
 *   - scale words (system/architecture/integration/entire/all/...)
 *   - prompt length (short prompts rarely encode hard tasks)
 *
 * Each signal adds weight; the band thresholds were chosen so a single
 * noun fix is "easy", a two-feature request is "medium", and "refactor
 * the auth system and integrate it across all services" is "hard".
 */

export type Complexity = "abstract" | "easy" | "medium" | "hard";

export interface ComplexityAssessment {
  complexity: Complexity;
  /** Recommended decomposition depth (0 = no tasks, 3 = full tree). */
  depth: 0 | 1 | 2 | 3;
  /** Planned step budget: leaves of the decomposition tree. */
  plannedSteps: number;
  /** Score breakdown for transparency (never fabricated). */
  signals: {
    actions: number;
    conjunctions: number;
    entities: number;
    scaleWords: number;
    length: number;
    total: number;
  };
}

const EN_ABSTRACT =
  /\b(what|why|how does|how do|explain|compare|difference between|should i|is it|are they|can (we|i|you)|could (we|i|you)|opinion|thoughts|idea|tell me about)\b/i;
const RU_ABSTRACT =
  /(^|[^а-яё])(что такое|зачем|почему|как работает|как работают|объясни|объясните|сравни|в чем разница|в чём разница|стоит ли|можно ли|мысли|идея|подскажи|расскажи)(?=$|[^а-яё])/i;

const EN_ACTIONS =
  /\b(build|make|create|implement|add|fix|refactor|analyze|convert|parse|write|design|develop|improve|scan|check|test|support|enable|integrate|migrate|generate|remove|delete|update|upgrade|configure|deploy|extract|validate|optimize|document|wire|scaffold|extract)\b/gi;
const RU_ACTIONS =
  /(^|[^а-яё])(сделать|сделай|создать|создай|написать|напиши|построить|построй|добавить|добавь|исправить|исправь|починить|почини|реализовать|реализуй|разработать|разработай|улучшить|улучши|проверить|проверь|проанализировать|проанализируй|перевести|переведи|конвертировать|конвертируй|собрать|собери|настроить|настрой|интегрировать|интегрируй|перенести|перенеси|сгенерировать|сгенерируй|обновить|обнови|удалить|удали|оптимизировать|оптимизируй|описать|опиши|рефакторить|рефактори)(?=$|[^а-яё])/gi;

const EN_CONJUNCTIONS =
  /\b(and then|then also|as well as|plus|along with|after that|and also)\b/gi;
const RU_CONJUNCTIONS =
  /(^|[^а-яё])(а также|затем|потом|и ещё|и еще|плюс|вместе с)(?=$|[^а-яё])/gi;
// Bare "and"/"и" is too noisy in English; count it only between two
// action-shaped words. Kept simple: count multiple "and"/"и" occurrences.
const EN_AND = /\band\b/gi;
const RU_AND = /(^|[^а-яё])и(?=$|[^а-яё])/gi;

const EN_SCALE =
  /\b(system|architecture|entire|whole|all|every|across|integration|framework|platform|end-to-end|full|complete|migration|overhaul|infrastructure|pipeline)\b/gi;
const RU_SCALE =
  /(^|[^а-яё])(систем[а-яё]*|архитектур[а-яё]*|цел[а-яё]+|вс[еёюя][а-яё]*|интеграц[а-яё]*|платформ[а-яё]*|сквозн[а-яё]*|полн[а-яё]*|миграц[а-яё]*|инфраструктур[а-яё]*|конвейер[а-яё]*)(?=$|[^а-яё])/gi;

/** Count entities: file paths, quoted names, backticked code, CamelCase tokens. */
function countEntities(prompt: string): number {
  let n = 0;
  // File paths (src/foo.ts, ./bar, /baz) — counted once; strip them from
  // the prompt so a backticked path is not double-counted as "quoted code".
  const paths = prompt.match(/(?:\.?\/|src\/|tests\/)[\w./-]+\.\w+/g) ?? [];
  n += paths.length;
  const stripped = prompt.replace(/(?:\.?\/|src\/|tests\/)[\w./-]+\.\w+/g, " ");
  // Quoted names ("foo bar", 'baz qux')
  n += (stripped.match(/["'«][^"'»]{1,40}["'»]/g) ?? []).length;
  // Backticked code (`fooBar`) — ignore whitespace-only.
  n += (stripped.match(/`[^`"\s][^`]{0,39}`/g) ?? []).length;
  // CamelCase identifiers (3+ upper), e.g. MCP, TUI, AST
  n += (stripped.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  return n;
}

/** Count conjunctions (compound intent). */
function countConjunctions(prompt: string, language: "en" | "ru"): number {
  let n = 0;
  n += (prompt.match(EN_CONJUNCTIONS) ?? []).length;
  n += (prompt.match(RU_CONJUNCTIONS) ?? []).length;
  // Bare "and"/"и" counted only if it appears 2+ times (1 "and" is normal
  // English; 2+ usually signal compound intent).
  const ands = language === "ru" ? RU_AND : EN_AND;
  const andCount = (prompt.match(ands) ?? []).length;
  if (andCount >= 2) n += andCount - 1;
  return n;
}

/**
 * Classify a prompt into a complexity band and a decomposition depth.
 *
 * The thresholds were calibrated against the Orion corpus of past prompts
 * (think of them as "tuning knobs"); they are deliberately simple so the
 * behaviour is easy to reason about and to test.
 */
export function classifyComplexity(
  prompt: string,
  language: "en" | "ru" = /[а-яё]/i.test(prompt) ? "ru" : "en",
): ComplexityAssessment {
  const words = prompt.split(/\s+/).filter(Boolean).length;

  // Abstract: question/exploration, no deliverable verb.
  const abstractRe = language === "ru" ? RU_ABSTRACT : EN_ABSTRACT;
  const isAbstract =
    abstractRe.test(prompt) &&
    !(language === "ru" ? RU_ACTIONS : EN_ACTIONS).test(prompt);

  if (isAbstract) {
    return {
      complexity: "abstract",
      depth: 0,
      plannedSteps: 0,
      signals: {
        actions: 0,
        conjunctions: 0,
        entities: 0,
        scaleWords: 0,
        length: words,
        total: 0,
      },
    };
  }

  const actions = (
    prompt.match(language === "ru" ? RU_ACTIONS : EN_ACTIONS) ?? []
  ).length;
  const conjunctions = countConjunctions(prompt, language);
  const entities = countEntities(prompt);
  const scaleWords = (
    prompt.match(language === "ru" ? RU_SCALE : EN_SCALE) ?? []
  ).length;

  // Weighted score: entities and scale matter most; actions and "and"
  // signal compound intent; length is a mild tiebreaker.
  const total =
    actions * 1 +
    conjunctions * 2 +
    entities * 2 +
    scaleWords * 3 +
    (words > 12 ? 1 : 0) +
    (words > 24 ? 1 : 0);

  // Band thresholds (deliberately small integers — easy to test).
  //   easy:   1 noun fix, single entity    (total <= 3)
  //   medium: 2-3 actions, few entities    (total <= 8)
  //   hard:   system-scale / many entities (total >= 9)
  let complexity: Complexity;
  let depth: 0 | 1 | 2 | 3;
  if (total <= 3) {
    complexity = "easy";
    depth = 1;
  } else if (total <= 8) {
    complexity = "medium";
    depth = 2;
  } else {
    complexity = "hard";
    depth = 3;
  }

  // Planned leaves at this depth: 2^depth.
  //   depth 1 → 2, depth 2 → 4, depth 3 → 8 real steps.
  // (The 6/14/30 figures in the strategy count ALL tree nodes; we report
  // leaves as plannedSteps and expose depth so callers can compute the
  // full budget if they want — honest about what the number means.)
  const plannedSteps = 2 ** depth;

  return {
    complexity,
    depth,
    plannedSteps,
    signals: {
      actions,
      conjunctions,
      entities,
      scaleWords,
      length: words,
      total,
    },
  };
}
