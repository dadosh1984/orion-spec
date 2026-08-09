import {
  readJson,
  writeFileSafe,
  writeJson,
  ensureDir,
} from "../../utils/file.js";
import { existsSync } from "node:fs";
import { OrionTrack } from "../../core/track.js";
import { renderTemplate, TemplateLang } from "../../core/templates.js";
import { readProfile } from "../../core/profile.js";
import { extractCore, extractCoreClause } from "../think/refine.js";
import type { ArtifactSet, Proposal } from "../../type.js";

/**
 * Turn a free-text `platform` answer into a path-safe capability name.
 * Guided answers are free-form sentences ("node >= 22, CLI + MCP"), which
 * must never become filesystem paths. Identifiers are kept as-is; anything
 * else collapses to "core".
 *
 * The result is ALSO the spec's `# Spec:` heading, and drift (v0.20+)
 * requires that heading to match an exported symbol in `src/tasks` — so it
 * must be a valid JS identifier. v0.24.2: words join with `_` instead of
 * `-` — a hyphenated name like `read-only-mypy-...` can NEVER be exported
 * (hyphens are illegal in identifiers), which made drift unsatisfiable for
 * any change whose platform answer slugged into multiple words.
 */
export function toCapability(platform: string): string {
  const slug = platform
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(slug) && slug.length >= 2
    ? slug
    : "core";
}

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
    /history|истори|journal|\blog(?:s|ging|ged)?\b/,
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

/**
 * Strip leading action verbs/filler words from the goal.
 * (Moved to src/skills/think/refine.ts — shared with `think` titles.)
 */

/** Best-effort transliteration of known Russian words. */
function toEnglish(text: string): string {
  let out = text;
  for (const [re, to] of WORD_MAP) out = out.replace(re, to);
  return out;
}

/**
 * Derive a task checklist from the proposal's context (goal + platform)
 * instead of returning the same five generic tasks for every idea.
 * Deterministic keyword mapping — no model involved.
 *
 * Every task is honestly marked (v0.10):
 * - `fact`       — restated from the proposal itself (the goal verbatim);
 * - `assumption` — Orion's template/inference from keywords, which may be
 *   wrong (a false keyword match is possible). The user can see at a glance
 *   what was stated vs what was assumed.
 */
export interface DerivedTask {
  text: string;
  mark: "fact" | "assumption";
}

export function deriveTasks(proposal: Proposal): DerivedTask[] {
  const goal = proposal.goal.toLowerCase();
  const platform = proposal.platform.toLowerCase();
  const core = toEnglish(extractCore(goal));
  const tasks: DerivedTask[] = [];

  // Maintenance goals (fix/upgrade/refactor) get a RED→fix→verify plan
  // instead of build templates: "Scaffold project structure" and
  // "Document usage in README" are noise for a bug fix. Fires before the
  // feature categories so e.g. "fix the CLI parser" plans a fix, not a
  // new CLI.
  //
  // v0.25: maintenance is decided by the LEADING action verb only, not by
  // any keyword anywhere in the goal — "updates" inside a feature
  // description is content, not a repair request. "Fix the CLI parser"
  // → maintenance; "Add a converter that updates CSV files" → feature.
  const MAINTENANCE_VERBS =
    /\b(fix(?:es|ed|ing)?|bug(?:s)?|broken|regression|upgrade(?:d|s)?|upgrading|update(?:d|s)?|refactor(?:ed|ing)?|polish|repair(?:s|ed)?|maintain(?:ing)?|maintenance)\b|ошибк|сломан|почин|исправ|обнов|регресс/i;
  const leadingVerb = goal.match(/^\s*(?:please\s+)?([a-zа-яё]+)/i)?.[1] ?? "";
  if (MAINTENANCE_VERBS.test(leadingVerb)) {
    tasks.push({
      text: "Reproduce the failure: write a test that fails on the current code (RED)",
      mark: "assumption",
    });
    const clause = toEnglish(extractCoreClause(goal));
    if (clause) {
      tasks.push({ text: `Implement the fix: ${clause}`, mark: "fact" });
    }
    tasks.push({
      text: "Apply the fix without changing the external behavior/API",
      mark: "assumption",
    });
    tasks.push({
      text: "Verify the full test suite and gates still pass (GREEN)",
      mark: "assumption",
    });
    return tasks;
  }

  tasks.push({
    text: `Scaffold project structure for ${proposal.title}`,
    mark: "assumption",
  });

  // "no new CLI commands" is a constraint, not a request for a CLI — a
  // naive keyword match would turn it into the very thing the goal forbids.
  const forbidsCli = /\bno (?:new )?cli commands?\b/i.test(goal);
  const match = CATEGORIES.find(
    ([re]) => re.test(goal) && !(forbidsCli && re === CATEGORIES[0][0]),
  );
  tasks.push(
    match
      ? { text: match[1], mark: "assumption" }
      : { text: "Implement the core capability", mark: "assumption" },
  );

  // Concrete decomposition: the goal minus action words becomes a task.
  // Only when it is short and well-formed — the whole goal as a task line
  // would be noise, not honesty.
  if (core && core !== goal && core.length <= 90 && !core.includes(":")) {
    tasks.push({ text: `Implement the ${core}`, mark: "fact" });
  }

  // Known sub-entities become their own tasks with real details.
  const details = DETAILS.filter(([re]) => re.test(goal)).slice(0, 2);
  for (const [, detail] of details) {
    tasks.push({ text: `Add ${detail}`, mark: "assumption" });
  }

  tasks.push({
    text: "Cover the core capability with tests",
    mark: "assumption",
  });

  if (platform && !/(cli|web|server|node)/.test(platform)) {
    tasks.push({
      text: `Integrate with the ${proposal.platform} platform`,
      mark: "fact",
    });
  }

  tasks.push({ text: "Document usage in README", mark: "assumption" });
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
  opts?: { noCache?: boolean; lang?: TemplateLang },
): Promise<ArtifactSet> {
  const track = OrionTrack.init();
  const proposal = await loadProposal(title, track);
  if (!proposal) {
    throw new Error(
      `no proposal found for "${title}" — run "orion think ..." first`,
    );
  }

  const dir = `changes/${title}`;
  const capability = toCapability(proposal.platform);
  const specsDir = `${dir}/specs/${capability}`;
  const skipped: string[] = [];

  // Language: explicit --lang wins, then the profile's detected language,
  // then English. Only the prose sections change; the `# Spec:` drift key
  // and the task checklist format stay identical in both languages.
  const lang: TemplateLang =
    opts?.lang ?? (readProfile().language === "ru" ? "ru" : "en");

  // Idempotent writer: keeps the existing file, records it as skipped.
  const writeIfMissing = async (path: string, data: string): Promise<void> => {
    if (existsSync(path)) {
      skipped.push(path);
      return;
    }
    await writeFileSafe(path, data);
  };

  const proposalMd = renderTemplate(
    "proposal",
    {
      title,
      goal: proposal.goal,
      platform: proposal.platform || "any",
      constraints: proposal.constraints || "none",
      budget: proposal.budget || "unlimited",
      lessons: proposal.appliesLessons?.length
        ? `- **Lessons applied (v0.12):** ${proposal.appliesLessons.join(", ")}`
        : "",
    },
    title,
    lang,
  );

  const specMd = renderTemplate(
    "spec",
    { capability, goal: proposal.goal },
    title,
    lang,
  );
  const derived = deriveTasks(proposal);
  const assumptions = derived.filter((t) => t.mark === "assumption");
  const designMd = renderTemplate(
    "design",
    {
      title,
      assumptions:
        assumptions.length > 0
          ? assumptions.map((t) => `- ${t.text}`).join("\n")
          : "- none — everything below is stated in the proposal",
    },
    title,
    lang,
  );
  const tasksMd = renderTemplate(
    "tasks",
    {
      title,
      tasks: derived.map((t) => `- [ ] [${t.mark}] ${t.text}`).join("\n"),
    },
    title,
    lang,
  );

  const snippetsReadme = [
    "# Snippets",
    "",
    "Put one implementation snippet per task here.",
    "File name = task slug with dashes as underscores",
    "(e.g. `build_the_cli_entry_point.ts`); content = the code",
    "`orion forge` applies in the GREEN step of the task.",
    "",
  ].join("\n");

  await writeIfMissing(`${dir}/proposal.md`, proposalMd.text);
  await writeIfMissing(`${specsDir}/spec.md`, specMd.text);
  await writeIfMissing(`${dir}/design.md`, designMd.text);
  await writeIfMissing(`${dir}/tasks.md`, tasksMd.text);
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
