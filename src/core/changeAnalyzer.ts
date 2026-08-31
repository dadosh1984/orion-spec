import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../skills/forge/handler.js";

export interface ChangeImpactReport {
  changeId: string;
  affectedFiles: string[];
  tasksCount: number;
  estimatedDurationMs: number;
  potentialBreakingChanges: string[];
}

/**
 * Perform a static pre-flight impact analysis for a change without modifying code.
 */
export function analyzeChangeImpact(changeId: string): ChangeImpactReport {
  const tasks = readTasks(changeId);
  const affected = new Set<string>();
  const breaking: string[] = [];

  const taskFile = join("changes", changeId, "tasks.md");
  if (existsSync(taskFile)) {
    const content = readFileSync(taskFile, "utf8");
    const fileMatches = content.matchAll(
      /(?:src|tests|scripts)\/[a-zA-Z0-9_\-./]+\.(?:ts|js|mjs|json)/g,
    );
    for (const m of fileMatches) {
      affected.add(m[0]);
    }
  }

  for (const file of affected) {
    if (
      file.startsWith("src/core/") ||
      file.includes("registry.ts") ||
      file.includes("runtime.ts") ||
      file.includes("parse.ts")
    ) {
      breaking.push(`Modifies critical core path: ${file}`);
    }
  }

  return {
    changeId,
    affectedFiles: Array.from(affected),
    tasksCount: tasks.length,
    estimatedDurationMs: tasks.length * 450,
    potentialBreakingChanges: breaking,
  };
}
