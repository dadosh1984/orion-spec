import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { statusMark } from "../utils/term.js";

const MAX_HISTORY = 500;

export function historyPath(): string {
  return process.env.ORION_HISTORY_FILE ?? join(homedir(), ".orion", "history");
}

export function readHistory(): string[] {
  try {
    const path = historyPath();
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

export function appendHistory(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const path = historyPath();
    if (!existsSync(join(path, ".."))) mkdirSync(join(path, ".."), { recursive: true });
    const rows = readHistory().filter((r) => r !== trimmed);
    rows.push(trimmed);
    writeFileSync(path, rows.slice(-MAX_HISTORY).join("\n") + "\n", "utf8");
  } catch { /* best-effort */ }
}

export function historyCmd(args: string[]): { ok: boolean; text: string } {
  if (args[0] === "clear") {
    try { writeFileSync(historyPath(), "", "utf8"); } catch { /* ok */ }
    return { ok: true, text: `${statusMark("done")} history cleared` };
  }
  const rows = readHistory();
  if (rows.length === 0) {
    return { ok: true, text: `${statusMark("info")} No history yet. Run \`orion shell\` to start recording.` };
  }
  const n = args[0] ? Math.min(Number(args[0]), rows.length) : rows.length;
  const display = Number.isFinite(n) ? rows.slice(-n) : rows;
  return {
    ok: true,
    text: [`${statusMark("info")} History (${rows.length} entries, last ${display.length}):`,
      ...display.map((l, i) => `  ${String(rows.length - display.length + i + 1).padStart(3)}  ${l}`)].join("\n"),
  };
}
