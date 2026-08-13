/**
 * Task 4 — lesson notifications (drift-gate manifest for `# Spec: node`).
 *
 * Visible self-correction: when Orion records a lesson or attaches past
 * lessons, it prints a clear marker to stderr so the user sees the
 * learning happen in real time. stderr is protocol-safe — it never
 * corrupts the MCP JSON-RPC stream, and it shows up in the CLI terminal.
 * Disable with ORION_LESSON_NOTIFY=0.
 */
import { stderr as processStderr } from "node:process";

/** Notifications are on unless explicitly disabled. */
export function lessonNotifyEnabled(): boolean {
  return process.env.ORION_LESSON_NOTIFY !== "0";
}

/** Marker for a newly recorded self-correction lesson. */
export function notifyLesson(step: string, error: string): void {
  if (!lessonNotifyEnabled()) return;
  processStderr.write(
    `🧠 orion lesson recorded — ${step}: ${error.slice(0, 140)}\n`,
  );
}

/** Marker when `think` attaches past lessons to a new proposal. */
export function notifyLessonsApplied(count: number): void {
  if (!lessonNotifyEnabled() || count < 1) return;
  processStderr.write(
    `🧠 orion applies ${count} past lesson(s) to this proposal — see "Lessons applied" in proposal.md\n`,
  );
}

/** One-time marker when the profile file is created for the first time. */
export function notifyProfileCreated(path: string): void {
  if (!lessonNotifyEnabled()) return;
  processStderr.write(
    `🧠 orion created a user profile at ${path} — from now on orion adapts to your language, platform and topics\n`,
  );
}

/** Smoke entry for the forge-generated test: current notify state. */
export const lesson_notify_visible = (): string =>
  lessonNotifyEnabled() ? "notify-on" : "notify-off";
