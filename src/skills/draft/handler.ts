import {
  readJson,
  writeFileSafe,
  writeJson,
  ensureDir,
} from "../../utils/file.js";
import { existsSync } from "node:fs";
import { OrionTrack } from "../../core/track.js";
import type { ArtifactSet, Proposal } from "../../type.js";

/** Read a proposal from the cache by title. */
export async function loadProposal(
  title: string,
  track: OrionTrack,
): Promise<Proposal | null> {
  const cached = track.loadString(`proposal:${title}`);
  if (cached) {
    try {
      return JSON.parse(cached) as Proposal;
    } catch {
      /* fall through */
    }
  }
  return readJson<Proposal>(`changes/${title}/proposal.json`);
}

const SPEC_TEMPLATE = `# Spec: {{capability}}

## Purpose
{{goal}}

## Acceptance criteria
- [ ] Placeholder — refine during implementation
`;

const DESIGN_TEMPLATE = `# Design — {{title}}

## Overview
Deterministic plan derived from the proposal.

## Modules
- \`src/tasks/*\` — test-driven implementation units
- \`tests/*\` — RED-GREEN-REFACTOR test files

## Verification
- [ ] lint (pnpm lint)
- [ ] type-check (tsc --noEmit)
- [ ] unit tests (pnpm test)
`;

/**
 * Derive a task checklist from the proposal's context (goal + platform)
 * instead of returning the same five generic tasks for every idea.
 * Deterministic keyword mapping — no model involved.
 */
/** Leading action verbs / filler phrases stripped from the goal. */
const LEADING_ACTION =
  /^\s*(?:please\s+)?(?:make|build|create|implement|write|add|develop|design|need|needed|want|i want|i need|сделай|создай|построй|разработай|реализуй|напиши|добавь|нужен|нужно|сделать|создать|построить|разработать|реализовать|написать|добавить|требуется)(?:\s+|$)/i;

const LEADING_FILLER = /^(?:an?|the)\s+/i;

/** Product category recognised from the goal (RU + EN). */
const CATEGORIES: Array<[RegExp, string]> = [
  [
    /(cli|command|terminal|shell|командн)/,
    "Build the CLI entry point (arg parsing, sub-commands, exit codes)",
  ],
  [
    /(web|server|api|http|endpoint|rest|веб|сайт|сервер|страниц)/,
    "Implement the HTTP/API surface (routes, handlers, serialization)",
  ],
  [
    /(parser|parse|convert|transform|compiler|lint|linter|парсер|конвертер|компилятор|преобразов)/,
    "Implement the core parsing/transformation pipeline",
  ],
  [
    /(library|lib|package|module|sdk|библиотек|пакет|модул)/,
    "Implement the public library API surface",
  ],
  [
    /(app|tool|utility|утилит|приложени|инструмент|бот)/,
    "Implement the core capability",
  ],
];

/** Known sub-entities with concrete implementation details (max 2). */
const DETAILS: Array<[RegExp, string]> = [
  [
    /history|истори|journal|log/,
    "operation history: persistence, replay, undo",
  ],
  [
    /calculator|калькулятор|арифметик/,
    "arithmetic operations: add, subtract, multiply, divide",
  ],
  [
    /converter|конвертер|конвертац/,
    "format conversion: validation, edge cases, error reporting",
  ],
  [/parser|парсер/, "parsing: tokenizer/grammar, syntax errors"],
  [
    /todo|task list|список дел|задач/,
    "task list: create, read, update, delete, persistence",
  ],
  [/notes|заметк/, "notes: create, edit, delete, search"],
  [/csv/, "CSV: headers, quoted fields, line endings"],
  [/json/, "JSON: serialization, type correctness, error handling"],
  [/bot|чат|chat/, "messages: command dispatch, conversation flow"],
  [/git/, "git: history traversal, commit/diff inspection"],
];

/** Known Russian words translated for task wording (best effort). */
const WORD_MAP: Array<[RegExp, string]> = [
  [/калькулятор/g, "calculator"],
  [/историей|историю|истории|история/g, "history"],
  [/операций/g, "operations"],
  [/конвертер/g, "converter"],
  [/парсер/g, "parser"],
  [/сервер/g, "server"],
  [/бот/g, "bot"],
  [/заметк/g, "notes"],
  [/дашборд/g, "dashboard"],
  [/изменений/g, "changes"],
  // \b is ASCII-only in JS, so use lookarounds for the one-letter particles.
  [/(?<![а-яёa-z0-9])с(?![а-яёa-z0-9])/g, "with"],
  [/(?<![а-яёa-z0-9])и(?![а-яёa-z0-9])/g, "and"],
];

/** Strip leading action verbs/filler words from the goal. */
function extractCore(goal: string): string {
  return goal.replace(LEADING_ACTION, "").replace(LEADING_FILLER, "").trim();
}

/** Best-effort transliteration of known Russian words. */
function toEnglish(text: string): string {
  let out = text;
  for (const [re, to] of WORD_MAP) out = out.replace(re, to);
  return out;
}

export function deriveTasks(proposal: Proposal): string[] {
  const goal = proposal.goal.toLowerCase();
  const platform = proposal.platform.toLowerCase();
  const core = toEnglish(extractCore(goal));
  const tasks: string[] = [];

  tasks.push(`Scaffold project structure for ${proposal.title}`);

  const match = CATEGORIES.find(([re]) => re.test(goal));
  tasks.push(match ? match[1] : "Implement the core capability");

  // Concrete decomposition: the goal minus action words becomes a task.
  if (core && core !== goal) tasks.push(`Implement the ${core}`);

  // Known sub-entities become their own tasks with real details.
  const details = DETAILS.filter(([re]) => re.test(goal)).slice(0, 2);
  for (const [, detail] of details) tasks.push(`Add ${detail}`);

  tasks.push("Cover the core capability with tests");

  if (platform && !/(cli|web|server|node)/.test(platform)) {
    tasks.push(`Integrate with the ${proposal.platform} platform`);
  }

  tasks.push("Document usage in README");
  return tasks;
}

/**
 * `orion draft` — generate the full artifact set for a proposal:
 * proposal.md, specs/<capability>/spec.md, design.md, tasks.md, snippets/.
 *
 * Context-driven (no flags): artifacts that already exist are left
 * untouched (idempotent — hand edits are never clobbered); only the
 * missing files are generated.
 */
export async function draft(
  title: string,
  opts?: { noCache?: boolean },
): Promise<ArtifactSet> {
  const track = OrionTrack.init();
  const proposal = await loadProposal(title, track);
  if (!proposal) {
    throw new Error(
      `no proposal found for "${title}" — run "orion think ..." first`,
    );
  }

  const dir = `changes/${title}`;
  const capability = proposal.platform || "core";
  const specsDir = `${dir}/specs/${capability}`;
  const skipped: string[] = [];

  // Idempotent writer: keeps the existing file, records it as skipped.
  const writeIfMissing = async (path: string, data: string): Promise<void> => {
    if (existsSync(path)) {
      skipped.push(path);
      return;
    }
    await writeFileSafe(path, data);
  };

  const proposalMd = [
    `# Proposal — ${title}`,
    "",
    `**Goal:** ${proposal.goal}`,
    "",
    `- Platform: ${proposal.platform || "any"}`,
    `- Constraints: ${proposal.constraints || "none"}`,
    `- Budget: ${proposal.budget || "unlimited"}`,
    "",
  ].join("\n");

  const specMd = SPEC_TEMPLATE.replace("{{capability}}", capability).replace(
    "{{goal}}",
    proposal.goal,
  );
  const designMd = DESIGN_TEMPLATE.replaceAll("{{title}}", title);
  const tasksMd = [
    `# Tasks — ${title}`,
    "",
    ...deriveTasks(proposal).map((t) => `- [ ] ${t}`),
    "",
  ].join("\n");

  const snippetsReadme = [
    "# Snippets",
    "",
    "Put one implementation snippet per task here.",
    "File name = task slug with dashes as underscores",
    "(e.g. `build_the_cli_entry_point.ts`); content = the code",
    "`orion forge` applies in the GREEN step of the task.",
    "",
  ].join("\n");

  await writeIfMissing(`${dir}/proposal.md`, proposalMd);
  await writeIfMissing(`${specsDir}/spec.md`, specMd);
  await writeIfMissing(`${dir}/design.md`, designMd);
  await writeIfMissing(`${dir}/tasks.md`, tasksMd);
  await ensureDir(`${dir}/snippets`);
  await writeIfMissing(`${dir}/snippets/README.md`, snippetsReadme);
  await writeJson(`${dir}/proposal.json`, proposal);

  if (!opts?.noCache)
    track.store(`proposal:${title}`, JSON.stringify(proposal));

  return {
    proposal: `${dir}/proposal.md`,
    specs: [`${specsDir}/spec.md`],
    design: `${dir}/design.md`,
    tasks: `${dir}/tasks.md`,
    snippets: `${dir}/snippets`,
    skipped,
  };
}
