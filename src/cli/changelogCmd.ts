import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `orion changelog [title]` (v0.28) — generate a markdown CHANGELOG entry
 * from a change's result.md. With no title, it prints one entry per change
 * that has a result and no explicit version note upstream. Deterministic
 * and zero-LLM: only title, status and task counts are surfaced.
 */

interface ChangeSummary {
  title: string;
  status: string | null;
  tasks: string | null;
}

function loadChange(title: string): ChangeSummary {
  const base = join("changes", title);
  const s: ChangeSummary = { title, status: null, tasks: null };
  const result = join(base, "result.md");
  if (existsSync(result)) {
    const text = readFileSync(result, "utf8");
    const t = text.match(/- \*\*Status:\*\*\s*(.+)$/m);
    const tcount = text.match(/- \*\*Tasks:\*\*\s*(.+)$/m);
    if (t) s.status = t[1].trim();
    if (tcount) s.tasks = tcount[1].trim();
  }
  const proposal = join(base, "proposal.json");
  if (existsSync(proposal)) {
    try {
      const raw = JSON.parse(readFileSync(proposal, "utf8")) as {
        goal?: string;
      };
      if (raw.goal) s.tasks = s.tasks ?? raw.goal.slice(0, 80);
    } catch {
      /* ignore */
    }
  }
  return s;
}

function entry(summary: ChangeSummary): string {
  return [
    `### ${summary.title}`,
    "",
    summary.status ? `- **Status:** ${summary.status}` : null,
    summary.tasks ? `- **Progress:** ${summary.tasks}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function changelogFor(title: string): string {
  return entry(loadChange(title));
}

/** Entries for every change with a result.md, newest first. */
export function changelogAll(): string[] {
  const base = join("changes");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(join(base, d.name, "result.md")),
    )
    .map((d) => {
      const p = join(base, d.name, "result.md");
      return {
        name: d.name,
        mtime: statSync(p).mtimeMs,
        entry: entry(loadChange(d.name)),
      };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map((x) => x.entry);
}
