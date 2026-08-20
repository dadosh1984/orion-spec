import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  // 7. Stale changes: an INCOMPLETE change untouched for longer than the
  // threshold is a silent "hanging" artifact — the same honesty principle
  // orion applies to foreign code, applied to its own changes/. Warn (fail
  // the check) so they don't accumulate unnoticed; archive or finish them.
  const staleDays = Number(process.env.ORION_STALE_DAYS ?? 30);
  const stale = scanChanges().filter((r) => {
    if (r.status !== "INCOMPLETE") return false;
    const ageMs = Date.now() - new Date(r.changedAt).getTime();
    return ageMs > staleDays * 24 * 60 * 60 * 1000;
  });
  add(
    "stale-changes",
    stale.length === 0,
    stale.length
      ? `${stale.length} incomplete change(s) untouched >${staleDays}d: ${stale
          .map((r) => r.title)
          .join(", ")} — finish or \`orion change <id> --archive\``
      : `no incomplete change older than ${staleDays}d`,
  );

  // 8. Duplicate goals: two open changes chasing the same goal is a silent
  // fork (one gets finished, the other hangs — the exact failure mode that
  // left `shield-language-agnostic` and `shield-should-be-language` both in
  // the tree). Two deterministic signals, OR'd together:
  //   - goal-Jaccard on the `goal` field (catches same-language rewording)
  //   - slug-Jaccard on the directory title (catches cross-language forks:
  //     RU goal vs EN goal that share `shield-language-agnostic` in the
  //     slug). Lower threshold for slug because slugs are short.
  // No LLM. Flag pairs above either threshold so a human can merge or
  // archive the loser.
  const dupes = duplicateGoals(base);
  add(
    "duplicate-goals",
    dupes.length === 0,
    dupes.length
      ? `${dupes.length} near-duplicate goal(s): ${dupes
          .map((d) => `${d.a} ≈ ${d.b}`)
          .join("; ")} — merge or archive one`
      : "no two open changes chase the same goal",
  );

  return { checks, pass: checks.every((c) => c.ok) };
}

/**
 * Detect pairs of open changes whose normalized `goal` fields overlap enough
 * to be the same intent. Two deterministic signals, OR'd:
 *
 *   1. goal-Jaccard on the `goal` field (lowercase, strip non-alphanumerics,
 *      drop tokens shorter than 3 chars, compare token sets; threshold 0.6
 *      of the smaller set's tokens shared with the larger).
 *   2. slug-Jaccard on the directory title (split on `-`, drop short tokens,
 *      compare sets; threshold 0.5). Slugs are short, so the threshold is
 *      lower; this is the signal that catches cross-language forks where
 *      one goal is in Russian and the other in English but the slugs
 *      share their core tokens (the motivating case
 *      `shield-language-agnostic` vs `shield-should-be-language`).
 *
 * No LLM. Pairs above either threshold are flagged.
 */
function duplicateGoals(
  base: string,
  goalThreshold = 0.6,
  slugThreshold = 0.5,
): Array<{ a: string; b: string }> {
  if (!existsSync(base)) return [];
  type Entry = {
    title: string;
    goalTokens: Set<string>;
    slugTokens: Set<string>;
  };
  const goals: Entry[] = [];
  for (const d of readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === "archived") continue;
    const p = join(base, d.name, "proposal.json");
    if (!existsSync(p)) continue;
    let goal = "";
    try {
      goal =
        (JSON.parse(readFileSync(p, "utf8")) as { goal?: string }).goal ?? "";
    } catch {
      continue; // unparseable proposal is the `changes` check's job
    }
    const goalTokens = new Set(
      goal
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
    const slugTokens = new Set(
      d.name
        .toLowerCase()
        .split(/[-_]+/)
        .filter((t) => t.length > 2),
    );
    if (goalTokens.size === 0 && slugTokens.size === 0) continue;
    goals.push({ title: d.name, goalTokens, slugTokens });
  }

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const flagged = new Set<string>();
  const out: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < goals.length; i++) {
    for (let j = i + 1; j < goals.length; j++) {
      const a = goals[i];
      const b = goals[j];
      // Signal 1: goal-Jaccard on the smaller set vs larger set.
      let hit = false;
      if (a.goalTokens.size > 0 && b.goalTokens.size > 0) {
        const [smaller, larger] =
          a.goalTokens.size <= b.goalTokens.size
            ? [a.goalTokens, b.goalTokens]
            : [b.goalTokens, a.goalTokens];
        let shared = 0;
        for (const t of smaller) if (larger.has(t)) shared++;
        if (shared / smaller.size >= goalThreshold) hit = true;
      }
      // Signal 2: slug-Jaccard (catches cross-language forks).
      if (!hit && a.slugTokens.size > 0 && b.slugTokens.size > 0) {
        const [smaller, larger] =
          a.slugTokens.size <= b.slugTokens.size
            ? [a.slugTokens, b.slugTokens]
            : [b.slugTokens, a.slugTokens];
        let shared = 0;
        for (const t of smaller) if (larger.has(t)) shared++;
        if (shared / smaller.size >= slugThreshold) hit = true;
      }
      if (hit) {
        const k = pairKey(a.title, b.title);
        if (!flagged.has(k)) {
          flagged.add(k);
          out.push({ a: a.title, b: b.title });
        }
      }
    }
  }
  return out;
}
