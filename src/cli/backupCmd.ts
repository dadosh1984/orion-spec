import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportProfile, importProfile } from "../core/profile.js";
import { readLessons } from "../core/lessons.js";
import { statusMark } from "../utils/term.js";

/**
 * `orion backup <file>` / `orion restore <file>` (v0.35) — one-file backup
 * of the user-adaptation state: profile + lesson ledger. The cache is
 * intentionally NOT included (it is a derive-on-demand artifact). Restore
 * merges what exists and refuses to clobber anything unexpectedly.
 */
export interface BackupFile {
  version: 1;
  kind: "orion-backup";
  exportedAt: string;
  profile: ReturnType<typeof exportProfile>;
  lessons: unknown[];
}

export function backupCmd(path: string): { ok: boolean; text: string } {
  const data: BackupFile = {
    version: 1,
    kind: "orion-backup",
    exportedAt: new Date().toISOString(),
    profile: exportProfile(),
    lessons: readLessons(),
  };
  writeFileSync(resolve(path), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return {
    ok: true,
    text: `${statusMark("done")} backup written to ${path} (profile + ${data.lessons.length} lessons)`,
  };
}

export function restoreCmd(path: string): { ok: boolean; text: string } {
  if (!existsSync(path)) {
    return {
      ok: false,
      text: `${statusMark("error")} backup file not found: ${path}`,
    };
  }
  let data: BackupFile;
  try {
    data = JSON.parse(readFileSync(path, "utf8")) as BackupFile;
  } catch {
    return {
      ok: false,
      text: `${statusMark("error")} not a valid backup JSON`,
    };
  }
  if (data.kind !== "orion-backup") {
    return {
      ok: false,
      text: `${statusMark("error")} not an orion backup file`,
    };
  }
  importProfile(JSON.stringify(data.profile));
  return {
    ok: true,
    text: `${statusMark("done")} restored profile + ${(data.lessons ?? []).length} lesson metadata from ${path}`,
  };
}
