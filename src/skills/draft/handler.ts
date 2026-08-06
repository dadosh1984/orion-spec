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
export function deriveTasks(proposal: Proposal): string[] {
  const goal = proposal.goal.toLowerCase();
  const platform = proposal.platform.toLowerCase();
  const tasks: string[] = [];

  tasks.push(`Scaffold project structure for ${proposal.title}`);
  tasks.push(`Implement: ${proposal.goal}`);

  const core: Array<[RegExp, string]> = [
    [
      /(cli|command|terminal|shell)/,
      "Build the CLI entry point (arg parsing, sub-commands, exit codes)",
    ],
    [
      /(web|server|api|http|endpoint|rest)/,
      "Implement the HTTP/API surface (routes, handlers, serialization)",
    ],
    [
      /(parser|parse|convert|transform|compiler|lint|linter)/,
      "Implement the core parsing/transformation pipeline",
    ],
    [
      /(library|lib|package|module|sdk)/,
      "Implement the public library API surface",
    ],
    [/(app|tool|utility)/, "Implement the core capability"],
  ];
  const match = core.find(([re]) => re.test(goal));
  tasks.push(match ? match[1] : "Implement the core capability");

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
