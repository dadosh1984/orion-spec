/**
 * Atomic step decomposition (v0.51) — «eat an elephant in small bites».
 *
 * Takes the flat, keyword-derived task checklist from `deriveTasks` and
 * recursively splits each step until it is ATOMIC — a leaf the forge loop
 * can act on without hidden branching. Honest and deterministic: no LLM,
 * just signal counting (same spirit as `classifyComplexity`).
 *
 * Atomicity criteria (a step IS atomic when ALL hold):
 *   1. one action  — a single instrument call / file edit / API hit
 *   2. verifiable  — you can say done/not-done without interpretation
 *   3. no decision — no hidden "do A, if it fails do B" inside the step
 *
 * Guard / deadlock protection:
 *   - hard depth ceiling (default 4 levels). If a step is still not
 *     atomic there, we STOP splitting mechanically and turn the residual
 *     uncertainty into an `[ask-user]` clarifying question — the same
 *     principle as handling errors mid-step, applied to ambiguity itself.
 */

export interface AtomicLeaf {
  text: string;
  mark: "fact" | "assumption" | "ask-user";
  depth: number;
}

/** Number of action verbs; reused as the primary "one action" probe. */
const EN_ACTIONS =
  /\b(build|make|create|add|fix|refactor|analyze|convert|parse|write|design|develop|improve|scan|check|test|support|enable|integrate|migrate|generate|remove|delete|update|upgrade|configure|deploy|extract|validate|optimize|document|wire|scaffold|implement)\b/gi;
const RU_ACTIONS =
  /(^|[^а-яё])(сделать|сделай|создать|создай|написать|напиши|построить|построй|добавить|добавь|исправить|исправь|починить|почини|реализовать|реализуй|разработать|разработай|улучшить|улучши|проверить|проверь|проанализировать|проанализируй|перевести|переведи|конвертировать|конвертируй|собрать|собери|настроить|настрой|интегрировать|интегрируй|перенести|перенеси|сгенерировать|сгенерируй|обновить|обнови|удалить|удали|оптимизировать|оптимизируй|описать|опиши|рефакторить|рефактори)(?=$|[^а-яё])/gi;

/** Coordination / alternatives that hide a decision point inside a step. */
const EN_SPLITTERS =
  /\b(and|then|also|as well as|if|else|unless|or|while|once|after|before|which|that requires)\b/i;
const RU_SPLITTERS =
  /(^|[^а-яё])(и|затем|потом|если|иначе|или|после|перед|пока|котор|также)(?=$|[^а-яё])/i;

/**
 * Count action verbs, skipping words used as noun objects (directly after a
 * determiner: "a test", "the check", "an upgrade") so "add a test" and
 * "run the check" count as ONE action, not two. The leading/real verb of a
 * fragment drives atomicity.
 */
export function countActions(
  text: string,
  lan: "en" | "ru",
): number {
  const re = lan === "ru" ? RU_ACTIONS : EN_ACTIONS; // /g flag
  re.lastIndex = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    // A determiner before a verb-like word marks it as a noun object
    // ("add a test" → "test" is a noun, not an action).
    if (!/(?:a|an|the|this|that|some)\s+$/i.test(before)) {
      n++;
    }
  }
  return n;
}

/**
 * Is this step atomic? Fewer than 2 action verbs AND no coordination/
 * alternative splitter. A short single-imperative is self-verifying; the
 * forge loop asserts success via its checkbox/tests, so we do not hard-require
 * an explicit deliverable marker (that would falsely reject atomic steps
 * like "implement the --verbose flag").
 */
export function isAtomicStep(text: string): boolean {
  const lan = /[а-яё]/i.test(text) ? "ru" : "en";
  const verbs = countActions(text, lan);
  const hasSplitter = (lan === "ru" ? RU_SPLITTERS : EN_SPLITTERS).test(text);
  return verbs < 2 && !hasSplitter;
}

/**
 * Deterministically split one non-atomic step into 2-4 fragment subtasks:
 * cut at the first coordination/alternative separator, producing the left
 * and right clauses. Zero-knowledge fallback: a soft wrap at the clause
 * boundary. Never assumed atomic — each fragment is re-checked by the
 * recursion in `atomicTree`.
 */
export function splitStep(text: string): string[] {
  const lan = /[а-яё]/i.test(text) ? "ru" : "en";
  const re = lan === "ru" ? RU_SPLITTERS : EN_SPLITTERS;
  const m = re.exec(text);
  if (m) {
    const left = text.slice(0, m.index).trim();
    let right = text.slice(m.index + m[0].length).trim();
    // Drop dangling conjunction at the start of the right clause.
    right = right.replace(lan === "ru" ? /^(и|а|затем|потом)\s+/i : /^(and|then|also|to)\s+/i, "");
    if (left && right && left !== right) return [left, right];
  }
  // No splitter: wrap long text at the first comma or ';' if present.
  const punc = text.search(/[,;]/);
  if (punc > 3 && punc < text.length - 3) {
    const left = text.slice(0, punc).replace(/[,;]$/, "").trim();
    const right = text.slice(punc + 1).trim();
    if (left && right) return [left, right];
  }
  // Last-resort: return the whole thing unchanged; recursion's depth
  // ceiling will turn it into an [ask-user] leaf rather than loop forever.
  return [text];
}

export interface AtomicTreeOptions {
  /** Hard ceiling on recursion depth (default 4) — deadlock guard. */
  maxDepth?: number;
  /** Skip atomic recursion for depth < 2 (flat checklist compat). */
  depth?: 0 | 1 | 2 | 3;
}

export interface AtomicInput {
  text: string;
  mark: "fact" | "assumption";
}

/**
 * Build the atomic leaf set for a list of steps. When `depth < 2` the
 * input is returned verbatim (backward-compatible flat checklist); for
 * depth >= 2 every non-atomic step is recursively split to a leaf or, at
 * the ceiling, downgraded to an `[ask-user]` clarifying question.
 */
export function atomicTree(
  items: AtomicInput[],
  { maxDepth = 4, depth = 2 }: AtomicTreeOptions = {},
): AtomicLeaf[] {
  if ((depth ?? 0) < 2) {
    return items.map((i) => ({ text: i.text, mark: i.mark, depth: 0 }));
  }
  const out: AtomicLeaf[] = [];
  const walk = (text: string, level: number, mark: "fact" | "assumption"): void => {
    if (isAtomicStep(text) || level >= maxDepth) {
      out.push({
        text,
        mark: isAtomicStep(text) ? mark : "ask-user",
        depth: level,
      });
      return;
    }
    for (const frag of splitStep(text)) {
      walk(frag, level + 1, mark);
    }
  };
  for (const i of items) walk(i.text, 1, i.mark);
  return out;
}
