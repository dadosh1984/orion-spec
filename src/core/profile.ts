import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { TITLE_STOPWORDS } from "./titles.js";

/**
 * User-adaptation profile (v0.26) — the memory.md analogue.
 *
 * `~/.orion/profile.md` remembers how the user works across projects:
 * prompt language, typical platform and budget, frequent topic words.
 * `think` updates it on every proposal; the CLI (`orion profile`) and the
 * MCP `profile` tool read it; the user can edit it by hand.
 *
 * Honesty rules:
 * - Orion only rewrites the `## Auto (updated by Orion)` section — the
 *   `## User notes` section and everything after it is preserved verbatim
 *   (a hand-written memory is never clobbered);
 * - deterministic, zero dependencies, fail-safe: a missing or broken file
 *   reads as defaults and never crashes the caller;
 * - a no-op update (nothing changed) does not rewrite the file.
 */

export interface UserProfile {
  /** False when the file does not exist yet. */
  exists: boolean;
  language: "ru" | "en";
  platform: string;
  budget: string;
  /** Frequent topic words, most significant first. */
  topics: string[];
  /** Word → frequency (v0.25), persisted as "Topic counts". */
  topicCounts: Record<string, number>;
  /** Everything after `## User notes` — preserved verbatim. */
  notes: string;
}

/** Signals `think` records after each proposal. */
export interface ProfileSignals {
  language?: "ru" | "en";
  platform?: string;
  budget?: string;
  /** Goal words to fold into the frequent-topics list. */
  words?: string[];
}

const NOTES_HEADING = "## User notes";

/** Profile path (tests override via ORION_PROFILE_FILE). */
export function profilePath(): string {
  return (
    process.env.ORION_PROFILE_FILE ?? join(homedir(), ".orion", "profile.md")
  );
}

/** Read the profile; defaults on a missing or corrupt file (fail-safe). */
/**
 * Memoized readProfile (v0.31): readProfile is called from think/draft/
 * serve/doctor repeatedly in one process; the file is small but stat+read
 * per call adds up. Cache by path+mtime+size; invalidates the moment the
 * file changes (tests rewrite the profile between calls and stay honest).
 */
const profileCache = new Map<string, { key: string; value: UserProfile }>();

export function readProfile(): UserProfile {
  const path = profilePath();
  let cacheKey = "missing";
  try {
    const st = statSync(path);
    cacheKey = `${st.mtimeMs}:${st.size}`;
  } catch {
    cacheKey = "missing";
  }
  const hit = profileCache.get(path);
  if (hit && hit.key === cacheKey) return hit.value;
  const defaults: UserProfile = {
    exists: false,
    language: "en",
    platform: "",
    budget: "",
    topics: [],
    topicCounts: {},
    notes: "",
  };
  let result: UserProfile;
  try {
    if (!existsSync(path)) {
      result = defaults;
    } else {
      const text = readFileSync(path, "utf8");
      // Split on the heading as a full line — a code-span mention like
      // "`## User notes`" inside the header must never split here.
      const heading = text.match(/^## User notes$/m);
      const notesIdx = heading ? (heading.index ?? -1) : -1;
      const auto = notesIdx >= 0 ? text.slice(0, notesIdx) : text;
      const notes =
        notesIdx >= 0 ? text.slice(notesIdx + NOTES_HEADING.length).trim() : "";
      const notesValue = /^\(.*\)$/.test(notes) ? "" : notes;
      const get = (label: string): string => {
        const m = auto.match(new RegExp(`^-\\s*${label}:\\s*(.+)$`, "m"));
        if (!m) return "";
        const v = m[1].trim();
        return /^\(.*\)$/.test(v) ? "" : v;
      };
      const lang = get("Language").toLowerCase();
      const counts = new Map<string, number>();
      for (const entry of get("Topic counts").split(",")) {
        const m = entry.match(/^\s*([^:]+):\s*(\d+)\s*$/);
        if (m) counts.set(m[1].trim(), Number(m[2]));
      }
      let topics = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w);
      if (topics.length === 0) {
        topics = get("Frequent topics")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && !/^\(.*\)$/.test(t));
        for (const t of topics) counts.set(t, 1);
      }
      result = {
        exists: true,
        language:
          lang === "ru" ? "ru" : lang === "en" ? "en" : defaults.language,
        platform: get("Platform"),
        budget: get("Budget"),
        topics,
        topicCounts: Object.fromEntries(counts),
        notes: notesValue,
      };
    }
  } catch {
    result = defaults;
  }
  profileCache.set(path, { key: cacheKey, value: result });
  return result;
}

/**
 * Action verbs (RU+EN) that never describe a topic — v0.25. Goals start
 * with verbs ("сделай", "build", "почини"); topics must be the nouns
 * that follow.
 */
const ACTION_WORDS: ReadonlySet<string> = new Set([
  "make",
  "build",
  "create",
  "implement",
  "write",
  "add",
  "develop",
  "design",
  "need",
  "want",
  "improve",
  "enhance",
  "refactor",
  "update",
  "upgrade",
  "fix",
  "repair",
  "maintain",
  "migrate",
  "convert",
  "generate",
  "check",
  "test",
  "run",
  "use",
  "support",
  "handle",
  "allow",
  "prevent",
  "ensure",
  "provide",
  "include",
  "remove",
  "change",
  "move",
  "copy",
  "delete",
  "install",
  "setup",
  "configure",
  "deploy",
  "publish",
  "release",
  "merge",
  "start",
  "stop",
  "restart",
  "сделай",
  "сделать",
  "создай",
  "создать",
  "построй",
  "построить",
  "разработай",
  "разработать",
  "реализуй",
  "реализовать",
  "напиши",
  "написать",
  "добавь",
  "добавить",
  "почини",
  "починить",
  "исправь",
  "исправить",
  "улучшь",
  "улучшить",
  "проверь",
  "проверить",
  "переведи",
  "перевести",
  "конвертируй",
  "конвертировать",
  "собери",
  "собрать",
  "настрой",
  "настроить",
  "интегрируй",
  "интегрировать",
  "перенеси",
  "перенести",
  "сгенерируй",
  "сгенерировать",
  "обнови",
  "обновить",
  "удали",
  "удалить",
  "измени",
  "изменить",
]);

/**
 * Most frequent significant words: length >= 4, stopwords and action
 * verbs stripped, deduped, capped at `limit` (default 8). Deterministic —
 * ties break by first occurrence.
 */
export function countTopics(words: string[], limit = 8): string[] {
  const freq = new Map<string, number>();
  for (const w of words) {
    const t = w.toLowerCase().trim();
    if (t.length < 4 || TITLE_STOPWORDS.has(t) || ACTION_WORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * Merge new signals into the profile and rewrite the file. The user-notes
 * section is preserved verbatim; a no-op update skips the write. Returns
 * the resulting profile (fail-safe: never throws).
 */
export function updateProfile(signals: ProfileSignals): UserProfile {
  try {
    const prev = readProfile();
    // Frequency map (v0.25): persisted counts + new signal words.
    const counts = new Map<string, number>(Object.entries(prev.topicCounts));
    for (const t of prev.topics) if (!counts.has(t)) counts.set(t, 1);
    for (const w of countTopics(signals.words ?? []))
      counts.set(w, (counts.get(w) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const topics = sorted.slice(0, 8).map(([w]) => w);
    const topicCounts = sorted
      .slice(0, 8)
      .map(([w, c]) => `${w}:${c}`)
      .join(", ");
    const next: UserProfile = {
      exists: true,
      language: signals.language ?? prev.language,
      platform: signals.platform ?? prev.platform,
      budget: signals.budget ?? prev.budget,
      topics,
      topicCounts: Object.fromEntries(sorted.slice(0, 8)),
      notes: prev.notes,
    };
    const same =
      prev.exists &&
      next.language === prev.language &&
      next.platform === prev.platform &&
      next.budget === prev.budget &&
      next.topics.join(",") === prev.topics.join(",");
    if (same) return prev;
    const text = [
      "# Orion user profile",
      "",
      "Auto-maintained by Orion. Edit any value; the `## User notes`",
      "section is preserved verbatim on every update.",
      "",
      "## Auto (updated by Orion)",
      `- Language: ${next.language}`,
      next.platform
        ? `- Platform: ${next.platform}`
        : "- Platform: (not yet observed)",
      next.budget ? `- Budget: ${next.budget}` : "- Budget: (not yet observed)",
      next.topics.length > 0
        ? `- Frequent topics: ${next.topics.join(", ")}`
        : "- Frequent topics: (none yet)",
      topicCounts ? `- Topic counts: ${topicCounts}` : "",
      "",
      NOTES_HEADING,
      prev.notes
        ? `\n${prev.notes}\n`
        : "\n(anything you write below this heading is kept as-is)\n",
    ]
      .filter((l) => l !== "")
      .join("\n");
    writeFileSync(profilePath(), text, "utf8");
    return next;
  } catch {
    return readProfile();
  }
}

/** Portable JSON export of the profile (v0.27) — machine-readable, safe
 * to commit or send between machines. */
export function exportProfile(): Record<string, unknown> {
  const p = readProfile();
  return {
    version: 1,
    language: p.language,
    platform: p.platform,
    budget: p.budget,
    topics: p.topics,
    topicCounts: p.topicCounts,
    notes: p.notes,
  };
}

/** Import a profile export (v0.27): writes the Auto section from JSON and
 * restores notes. Returns the file path written. */
export function importProfile(raw: unknown): string {
  const data =
    typeof raw === "string"
      ? (JSON.parse(raw) as Record<string, unknown>)
      : (raw as Record<string, unknown>);
  const language = data.language === "ru" ? "ru" : "en";
  const platform = typeof data.platform === "string" ? data.platform : "";
  const budget = typeof data.budget === "string" ? data.budget : "";
  const topics = Array.isArray(data.topics)
    ? data.topics.filter((t): t is string => typeof t === "string").slice(0, 8)
    : [];
  const notes = typeof data.notes === "string" ? data.notes : "";
  const text = [
    "# Orion user profile",
    "",
    "Auto-maintained by Orion. Edit any value; the `## User notes`",
    "section is preserved verbatim on every update.",
    "",
    "## Auto (updated by Orion)",
    `- Language: ${language}`,
    platform ? `- Platform: ${platform}` : "- Platform: (not yet observed)",
    budget ? `- Budget: ${budget}` : "- Budget: (not yet observed)",
    topics.length > 0
      ? `- Frequent topics: ${topics.join(", ")}`
      : "- Frequent topics: (none yet)",
    "",
    NOTES_HEADING,
    notes
      ? `\n${notes}\n`
      : "\n(anything you write below this heading is kept as-is)\n",
  ]
    .filter((l) => l !== "")
    .join("\n");
  writeFileSync(profilePath(), text, "utf8");
  return profilePath();
}

/** Reset the auto-maintained section (v0.27): keeps user notes verbatim,
 * clears observed signals. Returns the fresh profile. */
export function resetProfile(): UserProfile {
  const prev = readProfile();
  const next: UserProfile = {
    exists: true,
    language: "en",
    platform: "",
    budget: "",
    topics: [],
    topicCounts: {},
    notes: prev.notes,
  };
  const text = [
    "# Orion user profile",
    "",
    "Auto-maintained by Orion. Edit any value; the `## User notes`",
    "section is preserved verbatim on every update.",
    "",
    "## Auto (updated by Orion)",
    "- Language: en",
    "- Platform: (not yet observed)",
    "- Budget: (not yet observed)",
    "- Frequent topics: (none yet)",
    "",
    NOTES_HEADING,
    prev.notes
      ? `\n${prev.notes}\n`
      : "\n(anything you write below this heading is kept as-is)\n",
  ]
    .filter((l) => l !== "")
    .join("\n");
  writeFileSync(profilePath(), text, "utf8");
  return next;
}
