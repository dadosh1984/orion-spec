import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { trace } from "./telemetry.js";
import { OrionTrack } from "./track.js";

/**
 * Orion Token Economy — a zero-dependency output compressor (v0.11).
 *
 * Compresses command output BEFORE an LLM agent reads it: test runners
 * collapse to failures + a count, git/ls/grep become compact, installs
 * become one line. Agent-agnostic: any MCP client can call the `compress`
 * MCP tool with its own bash output; Orion's own surfaces (shield, forge)
 * use the same library.
 *
 * Honesty rules (v0.10/v0.11):
 * - fail-safe: a throwing/mismatching rule falls back to the raw output,
 *   never fabricates content;
 * - matched=false when no rule applied — no fake "savings";
 * - token figures are ESTIMATES (bytes/4, no tokenizer) and say so;
 * - repeated identical inputs are served from the OrionTrack cache and
 *   labelled cached=true, never presented as fresh work.
 */

/** Options for `compress`. */
export interface CompressOptions {
  /** Return the raw output unchanged (plus a note) instead of compressing. */
  verbose?: boolean;
  /** Cache instance for repeated-input reuse (default: OrionTrack.init()). */
  track?: OrionTrack;
  /** Disable the cache entirely. */
  cache?: boolean;
  /** Long-line truncation length (default 160). */
  maxLen?: number;
}

/** Result of one compression pass. */
export interface CompressResult {
  out: string;
  inBytes: number;
  outBytes: number;
  savedBytes: number;
  /** 0..1 fraction of input bytes removed. */
  savedPct: number;
  /** True when a rule actually rewrote the output. */
  matched: boolean;
  /** True when this result was served from the cache, not recomputed. */
  cached: boolean;
  /** Human note about the estimate / verbosity. */
  note: string;
}

/** One row of the append-only economy log (~/.orion/economy.json). */
export interface EconomyEntry {
  ts: string;
  cmd: string;
  inBytes: number;
  outBytes: number;
  cached: boolean;
  /** Project scope (package.json name, git-root dir, or cwd basename). */
  project?: string;
  /** When this row records a skill PROMOTION (v0.52) — ties the economy
   * ledger to a specific proposed→approved skill so `run stats` can compute
   * real per-skill ROI. Absent on ordinary compress rows. */
  source?: {
    proposalId: string;
    promotedAt: number;
    replayScore: number;
  };
}

/** Per-project aggregate from the economy ledger (v0.11). */
export interface ProjectEconomy {
  project: string;
  entries: number;
  savedBytes: number;
  savedTokens: number;
}

/** Aggregate savings from the ledger (fresh runs only — cached hits repeat). */
export interface EconomySummary {
  entries: number;
  savedBytes: number;
  savedTokens: number;
  byProject: ProjectEconomy[];
}

/** A single deterministic compression rule. */
interface Rule {
  test: (cmd: string) => boolean;
  compress: (input: string, maxLen: number) => string | null;
}

/** Cache payload: the compressed result minus runtime-only fields. */
interface StoredCompress {
  out: string;
  outBytes: number;
  savedBytes: number;
  savedPct: number;
  matched: boolean;
}

/** Rough token estimate: ~4 bytes per token (BPE heuristic, no tokenizer). */
export function estimateTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

const DEFAULT_MAX_LEN = 160;
const TOKEN_CAVEAT = "≈ tokens: bytes/4 estimate (no tokenizer)";
const ELLIPSIS_MARKER = " … [+N ch]";

/** First whitespace-separated token of a command line. */
export function firstToken(cmd: string): string {
  const t = cmd.trim().split(/\s+/)[0] ?? "";
  return t.split(/[/\\]/).pop() ?? t;
}

/** Long-line truncation that never splits a code point (RU/CJK-safe). */
export function truncateLine(line: string, maxLen = DEFAULT_MAX_LEN): string {
  if (line.length <= maxLen) return line;
  // Cut at a code-point boundary (never mid-char), then mark the tail.
  const cut = Array.from(line).slice(0, maxLen).join("");
  const dropped = Array.from(line).length - maxLen;
  return `${cut}${ELLIPSIS_MARKER.replace("N", String(dropped))}`;
}

/* ------------------------------- rules ------------------------------- */

const FAILURE_RE =
  /^\s*(?:[×✗✖❯]|FAIL\b)|(?:\b(?:AssertionError|Assertion failed|Cannot find module|SyntaxError|TypeError|ReferenceError|Unhandled Rejection)\b|error TS\d*:)|expected .* to (?:be|equal|deep|match)/i;
const SUMMARY_RE =
  /^\s*(Test Files|Tests|Duration|Snapshots|Time|All files|%?\s*Stmts|Statements|Branches|Functions|Lines|Coverage)/;

/** vitest / jest / mocha / any `* test` runner: failures + summary only. */
function testRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const failures: string[] = [];
  const summaries: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (FAILURE_RE.test(line)) {
      const t = truncateLine(line, maxLen);
      if (!failures.includes(t)) failures.push(t);
    } else if (SUMMARY_RE.test(line)) {
      const t = truncateLine(line, maxLen);
      if (!summaries.includes(t)) summaries.push(t);
    }
    if (failures.length >= 40 && summaries.length >= 8) break;
  }
  const head = [];
  if (failures.length > 0) {
    head.push(`[orion] ${failures.length} failing line(s):`);
    head.push(...failures.slice(0, 40));
  } else if (summaries.length > 0) {
    head.push(`[orion] no failures detected — summary:`);
  }
  if (summaries.length > 0) head.push(...summaries.slice(0, 8));
  if (head.length === 0) return null;
  return head.join("\n");
}

/** eslint: error lines only (+count). */
function eslintRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const errors = lines
    .filter((l) => /\berror\b/i.test(l))
    .slice(0, 40)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (errors.length === 0) return null;
  return [`[orion] eslint: ${errors.length} error line(s):`, ...errors].join(
    "\n",
  );
}

/** tsc: `error TS…` lines only (+count). */
function tscRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const errors = lines
    .filter((l) => /error TS\d*:/i.test(l) || /^error TS/i.test(l))
    .slice(0, 40)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (errors.length === 0) return null;
  return [`[orion] tsc: ${errors.length} error(s):`, ...errors].join("\n");
}

const STATUS_CODES: Record<string, string> = {
  "??": "??",
  A: "A",
  M: "M",
  D: "D",
  R: "R",
  modified: "M",
  deleted: "D",
  "new file": "A",
  renamed: "R",
  untracked: "??",
};

/** git status: branch line + compact status:path entries + counts. */
function gitStatusRule(input: string, _maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  const counts = new Map<string, number>();
  let branch: string | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const branchMatch = line.match(/^On branch (.+)$/);
    if (branchMatch) {
      branch = branchMatch[1];
      continue;
    }
    if (/^Your branch is/.test(line)) {
      out.push("  (branch synced)"); // keep the one-liner, skip the hint block
      continue;
    }
    if (/^\(use "git/.test(line) || /^\s*use "git/.test(line)) continue;
    if (
      /^\s*(Changes (not staged|to be committed)|Untracked files):$/.test(line)
    )
      continue;
    // untracked entries are "?? path" (no colon); status entries are
    // "status:  path" or porcelain "XY path".
    const untracked = line.match(/^\s*\?\?\s+(.+)$/);
    const status = line.match(
      /^\s*(modified|deleted|new file|renamed|untracked):\s+(.+)$/,
    );
    const porcelain = line.match(/^\s*([A-Z]{1,2})\s+(.+)$/);
    if (untracked) {
      counts.set("??", (counts.get("??") ?? 0) + 1);
      out.push(`?? ${untracked[1].trim()}`);
    } else if (status) {
      const code = STATUS_CODES[status[1]] ?? status[1];
      counts.set(code, (counts.get(code) ?? 0) + 1);
      out.push(`${code} ${status[2].trim()}`);
    } else if (porcelain) {
      const code = STATUS_CODES[porcelain[1]] ?? porcelain[1];
      counts.set(code, (counts.get(code) ?? 0) + 1);
      out.push(`${code} ${porcelain[2].trim()}`);
    }
  }
  if (out.length === 0) return null;
  const summary = [...counts.entries()]
    .map(([code, n]) => `${code}:${n}`)
    .join(", ");
  const head = branch
    ? `[orion] git status — on ${branch} (${summary})`
    : `[orion] git status — ${summary}`;
  const capped = out.slice(0, 60);
  const tail = out.length > 60 ? `  … (+${out.length - 60} more)` : "";
  return [...capped, tail, head].filter(Boolean).join("\n");
}

/** git diff: strip metadata headers, keep +/- lines, count hunks/files. */
function gitDiffRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  let files = 0;
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^diff --git /.test(line)) {
      files++;
      continue;
    }
    if (
      /^(index |--- |\+\+\+ |@@ |new file mode|deleted file mode|similarity |rename from |rename to )/.test(
        line,
      )
    )
      continue;
    if (/^[+-]/.test(line)) {
      kept.push(truncateLine(line, maxLen));
      if (kept.length >= 80) break;
    }
  }
  if (files === 0 && kept.length === 0) return null;
  const additions = kept.filter((l) => l.startsWith("+")).length;
  const deletions = kept.filter((l) => l.startsWith("-")).length;
  const head = `[orion] git diff — ${files} file(s), +${additions}/-${deletions} shown:`;
  return [head, ...kept].join("\n");
}

/** git log: keep "hash subject" lines only, count commits. */
function gitLogRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const commits = lines
    .filter((l) => /^[0-9a-f]{7,40}\s+/.test(l))
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (commits.length === 0) return null;
  const head = `[orion] git log — ${commits.length} commit(s):`;
  return [head, ...commits.slice(0, 60)].join("\n");
}

/** ls: long format → names + dir counts; short format → capped list. */
function lsRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  const names: string[] = [];
  let dirs = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^total\s+\d+/.test(line)) continue;
    // long format: "-rw-r--r-- 1 user group 123 Jan 1 12:00 name"
    const long = line.match(
      /^([drwxlst-]{10})\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/,
    );
    if (long) {
      const name = long[2].trim();
      if (name === "." || name === "..") continue;
      if (long[1][0] === "d") dirs++;
      names.push(truncateLine(name, maxLen));
    } else if (!/^([dl-])[rwxst-]{9}/.test(line)) {
      // short format: plain name tokens
      const name = line.trim();
      if (name === "." || name === ".." || name === "total") continue;
      names.push(truncateLine(name, maxLen));
    }
    if (names.length >= 60) break;
  }
  if (names.length === 0) return null;
  const head = `[orion] ls — ${names.length} entr${names.length === 1 ? "y" : "ies"} (${dirs} dir${dirs === 1 ? "" : "s"}):`;
  return [head, ...names].join("\n");
}

/** grep / rg: group by file, truncate matches. */
function grepRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const groups = new Map<string, string[]>();
  let matches = 0;
  for (const raw of lines) {
    const m = raw.match(/^([^:]+):(\d+):(.*)$/);
    if (!m) continue;
    const file = m[1].trim();
    const text = truncateLine(m[3], Math.min(maxLen, 120));
    const group = groups.get(file) ?? [];
    if (group.length < 3) group.push(`${file}:${m[2]}: ${text}`);
    groups.set(file, group);
    matches++;
  }
  if (matches === 0) return null;
  const filesLabel = `${groups.size} file${groups.size === 1 ? "" : "s"}`;
  const matchesLabel = `${matches} match${matches === 1 ? "" : "es"}`;
  const head = `[orion] grep — ${matchesLabel} in ${filesLabel}:`;
  const body = [...groups.keys()]
    .slice(0, 30)
    .flatMap((file) => [
      file,
      ...(groups.get(file) ?? []).map((l) => `  ${l}`),
    ]);
  return [head, ...body].join("\n");
}

/** pnpm/npm/yarn install: keep outcome/error lines only. */
function installRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const kept = lines
    .map((l) => l.trimEnd())
    .filter((l) => {
      if (/^Progress:/i.test(l)) return false; // noise, never an outcome
      return /(added|removed|changed|up to date|Done in|Packages?[:\s/]|ERR|WARN|ELIFECYCLE|error|warn|dependencies are up to date)/i.test(
        l,
      );
    })
    .slice(0, 12)
    .map((l) => truncateLine(l, maxLen));
  if (kept.length === 0) return null;
  return [`[orion] install — ${kept.length} outcome line(s):`, ...kept].join(
    "\n",
  );
}

/** docker ps/images: header + first rows, honest total count. */
function dockerTableRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const header = lines.find((l) => /CONTAINER ID|REPOSITORY/.test(l)) ?? "";
  const all = lines.filter(
    (l) => /^[0-9a-f]{12}\s/.test(l) || /^\S+\s+\S+\s+latest\s/.test(l),
  );
  if (all.length === 0) return null;
  const kept = all.slice(0, 15).map((l) => truncateLine(l.trimEnd(), maxLen));
  const kind = /CONTAINER ID/.test(header) ? "container" : "image";
  const tail =
    all.length > kept.length
      ? `  … (+${all.length - kept.length} more ${kind}s)`
      : "";
  return [
    `[orion] docker — ${all.length} ${kind}(s), ${kept.length} shown:`,
    header,
    ...kept,
    tail,
  ]
    .filter(Boolean)
    .join("\n");
}

/** docker logs: tail (the error lives at the end), count dropped lines. */
function dockerLogsRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 20) return null;
  const kept = lines.slice(-40).map((l) => truncateLine(l.trimEnd(), maxLen));
  const dropped = lines.length - kept.length;
  return [
    `[orion] docker logs — last ${kept.length} line(s), ${dropped} earlier dropped:`,
    ...kept,
  ].join("\n");
}

/** pytest: FAILED lines + === summary lines (keeps the verdict). */
function pytestRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const failed = lines
    .filter((l) => /^FAILED\s/.test(l.trimStart()))
    .slice(0, 40)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  const summary = lines
    .filter((l) =>
      /^={3,}\s.*(passed|failed|error|skipped)/.test(l.trimStart()),
    )
    .slice(0, 5)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (failed.length === 0 && summary.length === 0) return null;
  const head = failed.length
    ? `[orion] pytest — ${failed.length} FAILED test(s):`
    : "[orion] pytest — summary:";
  return [head, ...failed, ...summary].join("\n");
}

/** cargo test: test result lines, compiler errors, failure blocks. */
function cargoRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^test result:/.test(line)) {
      kept.push(line);
    } else if (/^error(\[E\d+\])?:/.test(line)) {
      kept.push(truncateLine(line, maxLen));
    } else if (/^---- /.test(line) || /^thread '/.test(line)) {
      kept.push(truncateLine(line, maxLen));
    }
    if (kept.length >= 40) break;
  }
  if (kept.length === 0) return null;
  return [`[orion] cargo — ${kept.length} result/error line(s):`, ...kept].join(
    "\n",
  );
}

/** terraform plan: Plan: summary + Error diagnostics only. */
function terraformRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const plan = lines.filter((l) => /^Plan: \d+ to add/.test(l.trimStart()));
  const errors = lines
    .filter((l) => /Error:|Error: /i.test(l.trimStart()))
    .slice(0, 20)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  const diag = lines
    .filter((l) => /^\s*│/.test(l) && /error|failed/i.test(l))
    .slice(0, 10)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (plan.length === 0 && errors.length === 0 && diag.length === 0)
    return null;
  return [`[orion] terraform plan —`, ...plan, ...errors, ...diag].join("\n");
}

/** npm list: tree head + problem lines (UNMET/invalid/extraneous). */
function npmListRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/);
  const problems = lines
    .filter((l) => /UNMET DEPENDENCY|invalid|extraneous/i.test(l))
    .slice(0, 20)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  const tree = lines
    .filter((l) => /^\S+@/.test(l.trimStart()) || /^[├└┌─│ ]*\S+@/.test(l))
    .slice(0, 30)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  if (tree.length === 0 && problems.length === 0) return null;
  const head = problems.length
    ? `[orion] npm list — ${problems.length} problem(s):`
    : `[orion] npm list — ${tree.length} top packages:`;
  return [head, ...problems, ...tree].join("\n");
}

/** pip freeze / ps: first rows + count (long lists collapse). */
function headListRule(input: string, maxLen: number): string | null {
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  const limit = 40;
  if (lines.length <= limit) return null;
  const kept = lines
    .slice(0, limit)
    .map((l) => truncateLine(l.trimEnd(), maxLen));
  return [
    `[orion] list — ${lines.length} line(s), ${kept.length} shown (+${lines.length - kept.length} dropped):`,
    ...kept,
  ].join("\n");
}

const RULES: Rule[] = [
  {
    test: (cmd) => /vitest|jest|mocha|ava|tape|\bnode --test\b/.test(cmd),
    compress: testRule,
  },
  {
    test: (cmd) => /(^|[/\\])(npm|pnpm|yarn)( |$)/.test(cmd),
    compress: testRule,
  },
  { test: (cmd) => /eslint/.test(cmd), compress: eslintRule },
  {
    test: (cmd) => /(^|\s)tsc(\s|$)|--noEmit|typecheck/.test(cmd),
    compress: tscRule,
  },
  { test: (cmd) => /^git status\b/.test(cmd), compress: gitStatusRule },
  { test: (cmd) => /^git diff\b/.test(cmd), compress: gitDiffRule },
  { test: (cmd) => /^git log\b/.test(cmd), compress: gitLogRule },
  { test: (cmd) => /(^|[/\\])ls(\s|$)/.test(cmd), compress: lsRule },
  { test: (cmd) => /\b(rg|grep)\b/.test(cmd), compress: grepRule },
  {
    test: (cmd) =>
      /(^|[/\\])(npm|pnpm|yarn)( |$).*\b(install|add|remove)\b/.test(cmd),
    compress: installRule,
  },
  { test: (cmd) => /^docker ps\b/.test(cmd), compress: dockerTableRule },
  { test: (cmd) => /^docker images\b/.test(cmd), compress: dockerTableRule },
  { test: (cmd) => /^docker logs\b/.test(cmd), compress: dockerLogsRule },
  { test: (cmd) => /\bpytest\b/.test(cmd), compress: pytestRule },
  { test: (cmd) => /\bcargo (test|build)\b/.test(cmd), compress: cargoRule },
  { test: (cmd) => /\bterraform plan\b/.test(cmd), compress: terraformRule },
  { test: (cmd) => /\bnpm list\b/.test(cmd), compress: npmListRule },
  {
    test: (cmd) => /\bpip freeze\b/.test(cmd),
    compress: headListRule,
  },
  {
    test: (cmd) => /(^|\s)ps(\s|$)/.test(cmd),
    compress: headListRule,
  },
];

/* ---------------------------- economy log ---------------------------- */

/** Append-only economy ledger (~/.orion/economy.jsonl; test override via ORION_ECONOMY_FILE). */
export function economyLogPath(): string {
  return (
    process.env.ORION_ECONOMY_FILE ?? join(homedir(), ".orion", "economy.jsonl")
  );
}

/** Maximum rows kept in the ledger (trimmed on read). */
const MAX_ECONOMY_ROWS = 5000;

/**
 * Append one economy entry as a JSONL line (atomic O_APPEND).
 * Race-condition-safe: every parallel process writes its own line without
 * reading the full file first. The cap (5000 rows) is applied on read.
 */
export function appendEconomy(entry: EconomyEntry): void {
  try {
    const path = economyLogPath();
    const line = JSON.stringify({ ...entry, project: entry.project ?? currentProject() }) + "\n";
    appendFileSync(path, line, "utf8");
  } catch {
    /* best effort — economy must never break the caller */
  }
}

/** Migrate old economy.json to economy.jsonl if it exists (idempotent, best-effort). */
function migrateLegacyEconomy(): void {
  try {
    const oldPath = join(homedir(), ".orion", "economy.json");
    const newPath = economyLogPath();
    if (!existsSync(oldPath) || existsSync(newPath)) return;
    const raw = JSON.parse(readFileSync(oldPath, "utf8"));
    if (Array.isArray(raw)) {
      const lines = raw.map((e: EconomyEntry) => JSON.stringify(e) + "\n").join("");
      writeFileSync(newPath, lines, "utf8");
      // Keep old file as backup; don't delete.
    }
  } catch {
    /* best effort */
  }
}

/**
 * Which project the current working directory belongs to:
 * package.json name → git-root directory name → cwd basename.
 * Zero-dependency: git root is found by walking up, no `git` exec.
 */
export function currentProject(): string {
  try {
    if (existsSync("package.json")) {
      const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
        name?: unknown;
      };
      if (typeof pkg.name === "string" && pkg.name.trim()) {
        return pkg.name.trim();
      }
    }
  } catch {
    /* fall through */
  }
  const root = gitRoot();
  if (root) return basename(root);
  return basename(process.cwd());
}

/** Nearest ancestor directory containing a .git entry, or null. */
function gitRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/** Read the economy ledger (empty when missing/corrupt). JSONL format: one JSON object per line. */
export function readEconomy(): EconomyEntry[] {
  try {
    migrateLegacyEconomy();
    const path = economyLogPath();
    if (!existsSync(path)) return [];
    const text = readFileSync(path, "utf8");
    const rows: EconomyEntry[] = [];
    for (const raw of text.split("\n")) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") rows.push(parsed as EconomyEntry);
      } catch {
        /* skip corrupt line */
      }
    }
    // Trim to MAX_ECONOMY_ROWS oldest lines on read.
    if (rows.length > MAX_ECONOMY_ROWS) rows.splice(0, rows.length - MAX_ECONOMY_ROWS);
    return rows;
  } catch {
    return [];
  }
}

/** Aggregate savings from the ledger (fresh runs only — cached hits repeat). */
export function economyStats(): EconomySummary {
  const rows = readEconomy();
  const savedBytes = rows
    .filter((r) => !r.cached && r.inBytes > r.outBytes)
    .reduce((sum, r) => sum + (r.inBytes - r.outBytes), 0);
  const byProject = new Map<string, ProjectEconomy>();
  for (const r of rows) {
    const project = r.project ?? "unknown";
    const group = byProject.get(project) ?? {
      project,
      entries: 0,
      savedBytes: 0,
      savedTokens: 0,
    };
    group.entries += 1;
    if (!r.cached && r.inBytes > r.outBytes)
      group.savedBytes += r.inBytes - r.outBytes;
    byProject.set(project, group);
  }
  const list = [...byProject.values()]
    .map((g) => ({ ...g, savedTokens: estimateTokens(g.savedBytes) }))
    .sort((a, b) => b.savedBytes - a.savedBytes);
  return {
    entries: rows.length,
    savedBytes,
    savedTokens: estimateTokens(savedBytes),
    byProject: list,
  };
}

/* ------------------------------ compress ------------------------------ */

function hashString(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

/**
 * Compress command output before it reaches an agent's context.
 *
 * Fail-safe: a mismatched or throwing rule returns the raw output with
 * matched=false — we never fabricate a summary we cannot back with data.
 */
export function compress(
  cmd: string,
  stdout: string,
  stderr = "",
  opts: CompressOptions = {},
): CompressResult {
  const input = [stdout ?? "", stderr ?? ""].filter(Boolean).join("\n");
  const inBytes = Buffer.byteLength(input, "utf8");
  // ANSI color codes would blind the line rules (vitest paints its output);
  // strip them so pattern matching sees plain text.
  const cleaned = input.replace(/\x1b\[[0-9;]*m/g, "");
  const maxLen = opts.maxLen ?? DEFAULT_MAX_LEN;
  const verbose = opts.verbose === true;
  const cache =
    opts.cache !== false && !verbose ? (opts.track ?? OrionTrack.init()) : null;
  const cacheKey = cache
    ? `compress:${hashString(`${cmd}\u0000${input}`)}`
    : null;

  // Repeated identical input → reuse the cached result (honestly labelled).
  if (cacheKey && cache) {
    const hit = cache.load(cacheKey) as StoredCompress | null;
    if (hit) {
      trace({
        type: "cache_hit",
        namespace: "compress",
        key: cacheKey,
        savedBytes: hit.savedBytes,
      });
      appendEconomy({
        ts: new Date().toISOString(),
        cmd: firstToken(cmd),
        inBytes,
        outBytes: inBytes,
        cached: true,
      });
      return {
        out: hit.out,
        inBytes,
        outBytes: hit.outBytes,
        savedBytes: hit.savedBytes,
        savedPct: hit.savedPct,
        matched: hit.matched,
        cached: true,
        note: TOKEN_CAVEAT,
      };
    }
  }

  let out = input;
  let matched = false;
  if (!verbose) {
    try {
      // Try every matching rule in order; the first that produces a real
      // rewrite wins. A rule returning null (unrecognized format) must not
      // block a later, more specific rule (e.g. "pnpm install" is both a
      // test-like and an install command). Honesty: the candidate must
      // actually be smaller than the cleaned input — wrapping a tiny
      // already-compact output in headers would be fake "savings".
      for (const rule of RULES) {
        if (!rule.test(cmd)) continue;
        const candidate = rule.compress(cleaned, maxLen);
        if (
          candidate !== null &&
          candidate.length > 0 &&
          candidate.length < cleaned.length
        ) {
          out = candidate;
          matched = true;
          break;
        }
      }
    } catch {
      matched = false;
      out = input;
    }
  }

  const outBytes = Buffer.byteLength(out, "utf8");
  const savedBytes = Math.max(0, inBytes - outBytes);
  const savedPct = inBytes > 0 ? savedBytes / inBytes : 0;

  if (matched) {
    out = `${out}\n\n[orion: −${savedBytes} B (−${(savedPct * 100).toFixed(1)}%) ≈ ${estimateTokens(savedBytes)} tok — ${TOKEN_CAVEAT}]`;
  } else if (verbose) {
    out = `${input}\n[orion: verbose — no compression applied]`;
  }

  if (cacheKey && cache && matched) {
    cache.store(cacheKey, {
      out,
      outBytes,
      savedBytes,
      savedPct,
      matched,
    } satisfies StoredCompress);
  }
  appendEconomy({
    ts: new Date().toISOString(),
    cmd: firstToken(cmd),
    inBytes,
    outBytes: matched ? outBytes : inBytes,
    cached: false,
  });

  return {
    out,
    inBytes,
    outBytes,
    savedBytes,
    savedPct,
    matched,
    cached: false,
    note: matched ? TOKEN_CAVEAT : "no rule matched — raw output kept",
  };
}
