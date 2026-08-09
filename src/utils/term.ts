/** Terminal helpers (v0.31): consistent colors/emojis, NO_COLOR aware,
 * shared by all human-facing commands. Keep it tiny — no regex games. */

/** ANSI disabled by explicit flag or the NO_COLOR convention (v0.23). */
export function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.ORION_COLOR === "0") return false;
  return process.platform !== "win32" || !!process.env.CI;
}

const PRETTY: Record<StatusEmoji, string> = {
  done: "\u2705", // ✅
  open: "\U0001F7E1", // 🟡
  error: "\u274C", // ❌
  warn: "\u26A0", // ⚠
  info: "\u2139", // ℹ
};
export type StatusEmoji = "done" | "open" | "error" | "warn" | "info";

/** Status marker used before a line (monochrome-safe fallback under NO_COLOR). */
export function statusMark(kind: StatusEmoji): string {
  if (!colorEnabled()) {
    return kind === "done" ? "[+]" : kind === "error" ? "[x]" : kind === "warn" ? "[!]" : kind === "open" ? "[.]" : "[i]";
  }
  return PRETTY[kind];
}

const COLORS: Record<string, number> = {
  green: 32,
  yellow: 33,
  red: 31,
  cyan: 36,
  dim: 2,
};
/** Color a status label; returns plain text under NO_COLOR. */
export function paint(text: string, color: keyof typeof COLORS): string {
  if (!colorEnabled()) return text;
  return `\u001b[${COLORS[color]}m${text}\u001b[0m`;
}

/** A simple proportional bar (plain under NO_COLOR), like the dashboard's. */
export function bar(ratio: number, width = 14): string {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const filled = Math.round(r * width);
  if (!colorEnabled()) return `${Math.round(r * 100)}%`;
  return "\u2588".repeat(filled) + "\u2591".repeat(Math.max(0, width - filled));
}
