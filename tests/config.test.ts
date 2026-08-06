import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../src/utils/file.js";
import { loadStages } from "../src/core/scale.js";
import { loadTddConfig } from "../src/core/tddCore.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-config-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("config resolution (package-aware)", () => {
  it("falls back to the installed package config outside the repo root", () => {
    // cwd is a foreign temp dir with no src/config — must resolve to the
    // package's own copy, not to a missing cwd-relative path.
    const trackPath = resolveConfig("orionTrack.json");
    expect(existsSync(trackPath)).toBe(true);
    // the package copy lives next to the toolkit's own source tree
    expect(trackPath).toContain("src");
    expect(trackPath).toContain("config");
  });

  it("a project-local src/config wins over the package default", () => {
    mkdirSync("src/config", { recursive: true });
    writeFileSync(
      "src/config/orionScale.json",
      JSON.stringify({ stages: ["yagni"] }),
      "utf8",
    );
    expect(loadStages()).toEqual(["yagni"]);
  });

  it("loadTddConfig and OrionTrack use the package fallback when local is absent", () => {
    const tdd = loadTddConfig();
    expect(tdd.testDir).toBe("tests");
    expect(tdd.testTemplate).toContain("describe");
    const stats = OrionTrack.init().getStats();
    expect(typeof stats.count).toBe("number");
  });
});
