import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Open templates (v0.13): the skeletons of draft artifacts (proposal.md,
 * design.md, tasks.md, spec.md) and think's clarifying questions become
 * data a user can edit without a release:
 *
 *   changes/<changeId>/templates/<name>   ← per-change override (highest)
 *   ~/.orion/templates/<name>             ← user-level override
 *   built-in skeleton                     ← fallback (never removed)
 *
 * Honesty: when an override is used, the generated artifact carries an
 * explicit `<!-- orion: template=<path> (custom) -->` marker — custom
 * output is never presented as the standard one. Zero dependencies:
 * rendering is plain `{{placeholder}}` substitution, no template language.
 */

export type TemplateKind =
  "proposal" | "design" | "tasks" | "spec" | "questions";

export type TemplateLang = "en" | "ru";

const FILE_EXT: Record<TemplateKind, "md" | "json"> = {
  proposal: "md",
  design: "md",
  tasks: "md",
  spec: "md",
  questions: "json",
};

/** User-level templates dir (~/.orion/templates; tests override via env). */
export function templatesDir(): string {
  return (
    process.env.ORION_TEMPLATES_DIR ?? join(homedir(), ".orion", "templates")
  );
}

/** Resolve a template to a file path, or null when only built-in exists. */
export function findTemplate(
  kind: TemplateKind,
  changeId?: string,
): string | null {
  const ext = FILE_EXT[kind];
  if (changeId) {
    const p = join("changes", changeId, "templates", `${kind}.${ext}`);
    if (existsSync(p)) return p;
  }
  const p = join(templatesDir(), `${kind}.${ext}`);
  return existsSync(p) ? p : null;
}

/** Built-in skeletons — the standard format, available even with no files. */
const BUILTIN: Record<TemplateKind, string> = {
  proposal: `# Proposal — {{title}}

## Goal
{{goal}}

## Context

| Aspect | Value |
|--------|-------|
| Platform | {{platform}} |
| Budget | {{budget}} |
| Constraints | {{constraints}} |

{{lessons}}
`,
  design: `# Design — {{title}}

## Overview
Deterministic plan derived from the proposal. Implementation is driven
task-by-task through the RED-GREEN-REFACTOR loop; every task below the
checklist in tasks.md becomes one test-driven unit in \`src/tasks/*\`.

## Modules

- \`src/tasks/*\` — test-driven implementation units (one per task)
- \`tests/*\` — RED-GREEN-REFACTOR test files (written first, RED)
- \`changes/{{title}}/snippets/*\` — per-task implementation hints

## Assumptions
{{assumptions}}

## Verification
Every task lands only when the gates pass:

- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
`,
  tasks: `# Tasks — {{title}}

Status legend: a checked box means done, an empty box means
open — forge flips each box as its task completes, so no manual
bookkeeping is needed.

{{tasks}}
`,
  spec: `# Spec: {{capability}}

## Purpose
{{goal}}

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
`,
  questions: `[
  { "key": "platform", "msg": "Platform?" },
  { "key": "constraints", "msg": "Constraints?" },
  { "key": "budget", "msg": "Budget?" }
]
`,
};

/** Russian skeletons (v0.27): selected via the profile language or --lang.
 * The `# Spec: {{capability}}` heading stays English on purpose — the drift
 * gate matches that literal key against exported symbols, so the machine
 * key must not vary with the user's language. */
const BUILTIN_RU: Record<TemplateKind, string> = {
  proposal: `# Предложение — {{title}}

## Цель
{{goal}}

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | {{platform}} |
| Бюджет | {{budget}} |
| Ограничения | {{constraints}} |

{{lessons}}
`,
  design: `# Дизайн — {{title}}

## Обзор
Детерминированный план, выведенный из предложения. Реализация ведётся
задачу за задачей через цикл RED-GREEN-REFACTOR; каждая задача из чеклиста
в tasks.md становится одним тест-управляемым юнитом в \`src/tasks/*\`.

## Модули

- \`src/tasks/*\` — тест-управляемые юниты реализации (по одному на задачу)
- \`tests/*\` — тест-файлы RED-GREEN-REFACTOR (пишутся первыми, RED)
- \`changes/{{title}}/snippets/*\` — подсказки реализации по задачам

## Допущения
{{assumptions}}

## Верификация
Задача считается сданной, только когда проходят все гейты:

- [ ] lint (pnpm lint)
- [ ] проверка типов (tsc --noEmit)
- [ ] юнит-тесты (pnpm test)
`,
  tasks: `# Задачи — {{title}}

Легенда статусов: отмеченный квадрат означает готово, пустой —
открыто; forge переключает каждый квадрат по мере выполнения задачи,
так что ручная сверка не нужна.

{{tasks}}
`,
  spec: `# Spec: {{capability}}

## Назначение
{{goal}}

## Область

- В области: указанная возможность, поставляется тест-первой.
- Вне области: всё, что не заявлено в предложении.

## Критерии приёмки
- [ ] Заполнить в ходе реализации
`,
  questions: `[
  { "key": "platform", "msg": "Платформа?" },
  { "key": "constraints", "msg": "Ограничения?" },
  { "key": "budget", "msg": "Бюджет?" }
]
`,
};

export interface RenderedTemplate {
  text: string;
  /** "builtin" or the filesystem path of the custom template. */
  source: "builtin" | string;
}

const MARKER = (path: string): string =>
  `\n\n<!-- orion: template=${path} (custom) -->\n`;

/**
 * Render a skeleton with {{placeholders}}. Custom templates get an honest
 * marker; built-ins stay clean. Placeholder values are plain-substituted
 * (no regex), so `$` and quotes in values are safe.
 */
export function renderTemplate(
  kind: TemplateKind,
  vars: Record<string, string>,
  changeId?: string,
  lang: TemplateLang = "en",
): RenderedTemplate {
  const custom = findTemplate(kind, changeId);
  let text = custom ? readFileSync(custom, "utf8") : (lang === "ru" ? BUILTIN_RU : BUILTIN)[kind];
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, v);
  }
  const trimmed = text.trimEnd();
  if (custom) {
    return { text: `${trimmed}${MARKER(custom)}`, source: custom };
  }
  return { text: `${trimmed}\n`, source: "builtin" };
}

export interface QuestionSpec {
  key: string;
  msg: string;
}

/**
 * User-editable think questions (questions.json). Returns null when no
 * (or an invalid) override exists — the caller keeps the built-in list.
 * Only known keys are honoured by the caller; unknown ones are ignored,
 * never silently injected into the proposal.
 */
export function loadQuestions(): QuestionSpec[] | null {
  const custom = findTemplate("questions");
  if (!custom) return null;
  try {
    const raw = JSON.parse(readFileSync(custom, "utf8")) as unknown;
    if (
      Array.isArray(raw) &&
      raw.every(
        (q) =>
          q !== null &&
          typeof q === "object" &&
          typeof (q as QuestionSpec).key === "string" &&
          typeof (q as QuestionSpec).msg === "string",
      )
    ) {
      return raw as QuestionSpec[];
    }
  } catch {
    /* fall through to built-in */
  }
  return null;
}
