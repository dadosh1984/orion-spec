import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OrionTrack } from "../core/track.js";
import { readLessons } from "../core/lessons.js";
import { readProfile } from "../core/profile.js";
import { scanChanges } from "./overviewCmd.js";
import { checkDistFresh } from "./distCheck.js";

/** `orion doctor` — deterministic environment and repo health checks. */
export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export function doctor(): { checks: DoctorCheck[]; pass: boolean } {
  const checks: DoctorCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail });

  // 1. Cache: writable and round-trip safe.
  try {
    const track = OrionTrack.init();
    const probe = `probe:${Date.now()}`;
    track.store(probe, "ok");
    add("cache", track.loadString(probe) === "ok", "store/load round-trip ok");
  } catch (err) {
    add("cache", false, err instanceof Error ? err.message : String(err));
  }

  // 2. Lessons ledger parses (or is absent — fine).
  try {
    const n = readLessons().length;
    add("lessons", true, `${n} lesson(s) parsed`);
  } catch (err) {
    add("lessons", false, err instanceof Error ? err.message : String(err));
  }

  // 3. Profile parses.
  try {
    const p = readProfile();
    add("profile", true, `language=${p.language}, ${p.topics.length} topic(s)`);
  } catch (err) {
    add("profile", false, err instanceof Error ? err.message : String(err));
  }

  // 4. Git repo present (informational — Orion works without it).
  add("git", existsSync(join(process.cwd(), ".git")), "repo root detected");

  // 5. Dist build matches src (stale dist is the classic "works locally,
  // breaks via CLI" trap).
  const dist = checkDistFresh();
  add("dist", dist.fresh, dist.detail);

  // 6. Changes/ consistency: every top-level entry is a real change.
  const base = join(process.cwd(), "changes");
  const orphans: string[] = [];
  if (existsSync(base)) {
    for (const d of readdirSync(base, { withFileTypes: true })) {
      if (d.isDirectory() && d.name !== "archived") {
        if (!existsSync(join(base, d.name, "proposal.json"))) {
          orphans.push(d.name);
        }
      }
    }
  }
  add(
    "changes",
    orphans.length === 0,
    orphans.length
      ? `junk dirs without proposal.json: ${orphans.join(", ")}`
      : `${scanChanges().length} change(s) consistent`,
  );

  return { checks, pass: checks.every((c) => c.ok) };
}
