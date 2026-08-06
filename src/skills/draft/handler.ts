import { readJson, writeFileSafe, writeJson } from "../../utils/file.js";
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

/** Default task checklist used when the proposal gives no explicit tasks. */
export function defaultTasks(title: string): string[] {
  return [
    `Scaffold project structure for ${title}`,
    "Implement core capability",
    "Cover core capability with tests",
    "Wire CLI entry point",
    "Document usage in README",
  ];
}

/**
 * `orion draft` — generate the full artifact set for a proposal:
 * proposal.md, specs/<capability>/spec.md, design.md, tasks.md.
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
    ...defaultTasks(title).map((t) => `- [ ] ${t}`),
    "",
  ].join("\n");

  await writeFileSafe(`${dir}/proposal.md`, proposalMd);
  await writeFileSafe(`${specsDir}/spec.md`, specMd);
  await writeFileSafe(`${dir}/design.md`, designMd);
  await writeFileSafe(`${dir}/tasks.md`, tasksMd);
  await writeJson(`${dir}/proposal.json`, proposal);

  if (!opts?.noCache)
    track.store(`proposal:${title}`, JSON.stringify(proposal));

  return {
    proposal: `${dir}/proposal.md`,
    specs: [`${specsDir}/spec.md`],
    design: `${dir}/design.md`,
    tasks: `${dir}/tasks.md`,
  };
}
