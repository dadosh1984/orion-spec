/**
 * Deterministic pre-execution hazard gate (v0.23, idea #1: "strict sandbox
 * via node:vm", implemented honestly).
 *
 * The naive version — wrapping tddCore in a node:vm context — is theatre:
 * the project's test runner is a CHILD process (`pnpm vitest run …`), and
 * node:vm cannot isolate a child process. A real OS sandbox (container /
 * seccomp / firejail) is out of scope for a zero-dependency CLI.
 *
 * What CAN be enforced deterministically and offline: never hand the test
 * runner code that carries destructive or escaping patterns. This scanner
 * gates AI-generated snippets (applyCode) and the files the test runner is
 * about to import (runTestDetailed), BEFORE they execute. The existing
 * fork-worker timeouts remain the second line of defence.
 *
 * Honesty: false positives are safer than false negatives here — a blocked
 * snippet is reported verbatim and can be reviewed and re-run, while an
 * executed `fs.rmSync('/', {recursive:true})` cannot. A clean scan is NOT a
 * guarantee of safety (it is a heuristic, like shield's security step);
 * docs/sandbox.md keeps saying exactly that.
 */

const HAZARDS: { re: RegExp; what: string }[] = [
  {
    re: /\brm(?:Sync|dirSync|dirsSync)\s*\(/,
    what: "destructive fs deletion (rm*)",
  },
  { re: /\bunlink(?:Sync)?\s*\(/, what: "destructive fs deletion (unlink)" },
  { re: /\bfs\.rm\s*\(/, what: "destructive fs deletion (fs.rm)" },
  { re: /\btruncate(?:Sync)?\s*\(/, what: "file truncation" },
  { re: /\bchmod\w*\s*\([^)]*0?777/, what: "chmod 777" },
  { re: /child_process/, what: "child-process spawn" },
  { re: /\bexec(?:Sync|File|FileSync)?\s*\(/, what: "shell execution" },
  { re: /\bspawn(?:Sync)?\s*\(/, what: "process spawn" },
  { re: /\beval\s*\(/, what: "dynamic eval" },
  { re: /new\s+Function\s*\(/, what: "dynamic Function constructor" },
  { re: /\bprocess\.exit\s*\(/, what: "process termination" },
  { re: /fetch\s*\(\s*["']https?:/, what: "outbound network call" },
];

/** Scan source for destructive/escaping patterns; returns human-readable hits. */
export function scanHazards(source: string): string[] {
  const found: string[] = [];
  for (const { re, what } of HAZARDS) {
    const m = source.match(re);
    if (m) found.push(`${what} ("${m[0].slice(0, 40)}")`);
  }
  return found;
}

/** Marker prefix for blocked results — the caller reports it verbatim. */
export const HAZARD_GATE_BLOCKED = "[hazard gate]";
