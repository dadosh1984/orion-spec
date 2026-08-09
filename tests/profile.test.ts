import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  profilePath,
  readProfile,
  updateProfile,
  countTopics,
} from "../src/core/profile.js";
import {
  lessonNotifyEnabled,
  notifyLesson,
  notifyLessonsApplied,
  notifyProfileCreated,
} from "../src/tasks/lesson_notify_visible.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-profile-"));
  process.chdir(dir);
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
});

afterEach(() => {
  delete process.env.ORION_PROFILE_FILE;
  delete process.env.ORION_LESSON_NOTIFY;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("profile store", () => {
  it("reads defaults when no profile exists yet", () => {
    const p = readProfile();
    expect(p.exists).toBe(false);
    expect(p.language).toBe("en");
    expect(p.platform).toBe("");
    expect(p.budget).toBe("");
    expect(p.topics).toEqual([]);
    expect(p.notes).toBe("");
  });

  it("updateProfile creates the file and round-trips", () => {
    const r = updateProfile({
      language: "ru",
      platform: "node",
      budget: "compact",
      words: ["build", "a", "parser", "converter", "parser"],
    });
    expect(r.exists).toBe(true);
    expect(r.language).toBe("ru");
    expect(r.platform).toBe("node");
    expect(r.budget).toBe("compact");
    expect(r.topics).toContain("parser");
    expect(r.topics).toContain("converter");

    const read = readProfile();
    expect(read).toEqual(r);
    const text = readFileSync(profilePath(), "utf8");
    expect(text).toContain("# Orion user profile");
    expect(text).toContain("## Auto (updated by Orion)");
    expect(text).toContain("## User notes");
  });

  it("preserves the user notes section verbatim across updates", () => {
    writeFileSync(
      profilePath(),
      [
        "# Orion user profile",
        "",
        "## Auto (updated by Orion)",
        "- Language: en",
        "- Platform: (not yet observed)",
        "- Budget: (not yet observed)",
        "- Frequent topics: (none yet)",
        "",
        "## User notes",
        "",
        "Пишите кратко и по-русски.",
        "",
      ].join("\n"),
      "utf8",
    );
    updateProfile({ language: "ru", words: ["конвертер"] });
    const read = readProfile();
    expect(read.notes).toContain("Пишите кратко и по-русски.");
    expect(read.language).toBe("ru");
  });

  it("skips the write when nothing changed (no-op update)", () => {
    updateProfile({ language: "ru", platform: "node", words: ["orion"] });
    const before = readFileSync(profilePath(), "utf8");
    updateProfile({ language: "ru", platform: "node", words: ["orion"] });
    expect(readFileSync(profilePath(), "utf8")).toBe(before);
  });

  it("merges new topics with previously learned ones", () => {
    updateProfile({ words: ["converter"] });
    updateProfile({ words: ["converter", "parser"] });
    const read = readProfile();
    expect(read.topics).toContain("converter");
    expect(read.topics).toContain("parser");
  });
});

describe("countTopics", () => {
  it("filters stopwords, short words and duplicates", () => {
    const topics = countTopics([
      "the",
      "a",
      "for",
      "csv",
      "CSV",
      "csv",
      "to",
      "x",
      "converter",
    ]);
    // "csv" (3 chars) is below the 4-char floor — by design.
    expect(topics).toEqual(["converter"]);
  });

  it("respects the limit and orders by frequency", () => {
    const topics = countTopics(
      ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"],
      3,
    );
    expect(topics).toHaveLength(3);
  });
});

describe("lesson notifications (visible self-correction)", () => {
  it("prints a clear marker to stderr on a recorded lesson", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    notifyLesson("shield", "check failed");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("🧠 orion lesson recorded — shield: check failed"),
    );
    spy.mockRestore();
  });

  it("prints how many past lessons are applied", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    notifyLessonsApplied(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("🧠 orion applies 3 past lesson(s)"),
    );
    spy.mockRestore();
  });

  it("prints a one-time marker when the profile is created", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    notifyProfileCreated("/tmp/profile.md");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("🧠 orion created a user profile"),
    );
    spy.mockRestore();
  });

  it("is silenced by ORION_LESSON_NOTIFY=0", () => {
    process.env.ORION_LESSON_NOTIFY = "0";
    expect(lessonNotifyEnabled()).toBe(false);
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    notifyLesson("shield", "check failed");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("is on by default", () => {
    expect(lessonNotifyEnabled()).toBe(true);
  });
});
