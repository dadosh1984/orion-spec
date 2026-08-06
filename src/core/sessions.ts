import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { recordLesson } from "./lessons.js";
import { currentProject } from "./compress.js";

/**
 * Session learning (v0.13): Orion learns from real agent-session history.
 * It reads JSONL sessions in any of several shapes (pi-style records with
 * `role`/`parts`; generic `{role, content}`; tool-call entries), finds
 * "failed then succeeded" pairs for the same action, and records them as
 * lessons in the same ledger that feeds `next`/`think` — so the next idea
 * knows about the mistakes actually made, not only workflow-step failures.
 *
 * Honesty ("no fake learning"): only actions whose output really carries an
 * error marker and that were later re-run with the same signature without
 * error produce a lesson; invalid JSON lines are counted in `skipped`, not
 * hidden; an empty result is a valid, honest answer.
 */

export interface SessionAction {
  tool: string;
  /** Normalized identity of the action for pairing (tool + first tokens). */
  signature: string;
  /** The invocation that produced the action (command/path), when known. */
  command: string;
  output: string;
}

export interface SessionPair {
  tool: string;
  signature: string;
  error: string;
  corrected: string;
  count: number;
}

export interface LearnReport {
  files: number;
  records: number;
  actions: number;
  pairs: number;
  lessons: number;
  skipped: number;
}

/** Error markers, word-bounded (EN + RU) — never a bare substring like "fail". */
const ERROR_MARKER_EN =
  /\b(error|failed|failing|exception|traceback|not found|no such (file|directory)|cannot|can't|could not|fatal|ENOENT|EACCES|EADDRINUSE|EADDRNOTAVAIL|ETIMEDOUT|ECONNREFUSED|ERR_[A-Z_]+|exit code [1-9]\d*)\b/i;
const ERROR_MARKER_RU = /(ошибк|не найден|не существует|провал|исключени)/i;

/** Does this output look like a failure? (first 2000 chars only — cheap.) */
export function hasError(output: string): boolean {
  const o = output.slice(0, 2000);
  return ERROR_MARKER_EN.test(o) || ERROR_MARKER_RU.test(o);
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : (p?.text ?? p?.content ?? "")))
      .join("\n");
  }
  if (content && typeof content === "object") {
    const c = content as { text?: unknown; content?: unknown };
    return String(c.text ?? c.content ?? "");
  }
  return "";
}

/** Normalize an invocation into a pair identity: tool + first significant tokens. */
export function signatureOf(tool: string, command: string): string {
  const base = command.trim();
  if (!base) return tool;
  const tokens = base
    .split(/\s+/)
    .filter((t) => t.length > 1 && !/^[0-9a-f]{8,}$/i.test(t));
  return [tool, ...tokens.slice(0, 2)].join(" ");
}

/**
 * Parse a JSONL session into an ordered action list. Understands pi-style
 * records (`message.role`, `content[]` parts with `toolCall`/`text`) and
 * generic records (`{role, content}`). Invalid lines → `skipped`.
 */
export function parseSession(jsonl: string): {
  actions: SessionAction[];
  records: number;
  skipped: number;
} {
  const actions: SessionAction[] = [];
  const calls = new Map<string, { tool: string; command: string }>();
  let records = 0;
  let skipped = 0;
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line) as Record<string, unknown>;
    } catch {
      skipped++;
      continue;
    }
    records++;
    const msg = (rec.message as Record<string, unknown> | undefined) ?? rec;
    const role = String(msg.role ?? rec.type ?? "");
    const content = msg.content;
    if (role === "assistant" || role === "toolCall" || role === "tool_use") {
      const parts = Array.isArray(content) ? content : [];
      for (const p of parts) {
        const part = (p ?? {}) as Record<string, unknown>;
        const kind = part.type ?? "";
        if (
          kind !== "toolCall" &&
          kind !== "tool_call" &&
          kind !== "function_call"
        ) {
          continue;
        }
        const id = String(part.id ?? part.toolCallId ?? "");
        const tool = String(part.name ?? part.toolName ?? "tool");
        const args = part.arguments ?? part.parameters ?? {};
        const command =
          typeof args === "string"
            ? args
            : String(
                (args as Record<string, unknown>).command ??
                  (args as Record<string, unknown>).path ??
                  (args as Record<string, unknown>).file ??
                  (args as Record<string, unknown>).cmd ??
                  "",
              );
        if (id) calls.set(id, { tool, command });
        actions.push({
          tool,
          signature: signatureOf(tool, command),
          command,
          output: "",
        });
      }
    } else if (
      role === "toolResult" ||
      role === "tool_result" ||
      role === "tool"
    ) {
      const tool = String(msg.toolName ?? msg.tool ?? rec.tool ?? "tool");
      const id = String(msg.toolCallId ?? rec.toolCallId ?? "");
      const call = id ? calls.get(id) : undefined;
      const command = call?.command ?? "";
      actions.push({
        tool,
        signature: signatureOf(tool, command),
        command,
        output: extractText(content ?? rec.content),
      });
    }
  }
  return { actions, records, skipped };
}

/**
 * Find "failed → succeeded" pairs: an action whose output carries an error
 * marker, followed (within a short window) by the same signature whose
 * output is present and clean. Each unique signature yields one pattern,
 * with an occurrence count. Never throws.
 */
export function findPairs(actions: SessionAction[]): SessionPair[] {
  const seen = new Map<string, SessionPair>();
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!hasError(a.output)) continue;
    for (let j = i + 1; j < Math.min(i + 8, actions.length); j++) {
      const b = actions[j];
      if (
        b.signature === a.signature &&
        b.output.trim() !== "" &&
        !hasError(b.output)
      ) {
        const prev = seen.get(a.signature);
        if (prev) prev.count++;
        else {
          seen.set(a.signature, {
            tool: a.tool,
            signature: a.signature,
            error: a.output.slice(0, 240),
            corrected: b.command || b.signature,
            count: 1,
          });
        }
        break;
      }
    }
  }
  return [...seen.values()];
}

/** Recursively collect *.jsonl files under a path (file or directory). */
export function sessionFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return path.toLowerCase().endsWith(".jsonl") ? [path] : [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (p.toLowerCase().endsWith(".jsonl")) out.push(p);
    }
  };
  walk(path);
  return out;
}

/**
 * Learn from one or more session files: aggregate failure→success pairs,
 * record each unique pattern as a lesson (changeId = current project), and
 * return an honest report. Never throws on unreadable content.
 */
export function learnFromSessions(paths: string[]): LearnReport {
  const report: LearnReport = {
    files: 0,
    records: 0,
    actions: 0,
    pairs: 0,
    lessons: 0,
    skipped: 0,
  };
  const patterns = new Map<string, SessionPair>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    report.files++;
    const parsed = parseSession(text);
    report.records += parsed.records;
    report.skipped += parsed.skipped;
    report.actions += parsed.actions.length;
    for (const pair of findPairs(parsed.actions)) {
      const prev = patterns.get(pair.signature);
      if (prev) prev.count += pair.count;
      else patterns.set(pair.signature, pair);
    }
  }
  const project = currentProject();
  for (const pair of patterns.values()) {
    report.pairs++;
    const lesson = recordLesson({
      changeId: project,
      step: "session",
      error: `${pair.tool}: ${pair.error}`.slice(0, 240),
      cause: "recurring session failure (failed then succeeded)",
      fix: `use: ${pair.corrected}`.slice(0, 240),
    });
    if (lesson.id !== "n/a") report.lessons++;
  }
  return report;
}
