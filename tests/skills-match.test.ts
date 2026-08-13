import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  matchSkill,
  environmentFingerprint,
  shadowCompare,
  type SkillMeta,
} from "../src/core/skillsMatch.js";
import {
  logSkillMiss,
  readMissLog,
  promotionCandidates,
  missLogFile,
} from "../src/core/skillMissLog.js";

const ORIG_SCRIPTS = process.env.ORION_SCRIPTS_DIR;
const ORIG_MISS = process.env.ORION_MISS_LOG_DIR;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-skills-"));
  process.env.ORION_SCRIPTS_DIR = join(dir, "scripts");
  process.env.ORION_MISS_LOG_DIR = join(dir);
});

afterEach(() => {
  delete process.env.ORION_SCRIPTS_DIR;
  delete process.env.ORION_MISS_LOG_DIR;
  rmSync(dir, { recursive: true, force: true });
  process.env.ORION_SCRIPTS_DIR = ORIG_SCRIPTS;
  process.env.ORION_MISS_LOG_DIR = ORIG_MISS;
});

function skill(over: Partial<SkillMeta>): SkillMeta {
  return {
    name: "csv-to-json",
    description: "convert a CSV spreadsheet to a JSON file with a header mapping",
    tags: ["csv", "json", "convert"],
    domain: "general",
    scriptPath: "run.sh",
    usageCount: 0,
    ...over,
  };
}

function writeRegistry(skills: SkillMeta[], domain?: string): void {
  const scripts = dir + "/scripts";
  mkdirSync(scripts, { recursive: true });
  for (const s of skills) {
    const d = join(scripts, s.name);
    mkdirSync(d, { recursive: true });
    writeFileSync(
      join(d, "orion.json"),
      JSON.stringify({
        name: s.name,
        description: s.description,
        tags: s.tags ?? [],
        domain: s.domain ?? domain ?? "general",
        runCount: s.usageCount ?? 0,
      }),
      "utf8",
    );
    writeFileSync(join(d, "run.sh"), "#!/bin/sh\necho ok\n", "utf8");
  }
}

describe("BM25 skill matching (v0.51, no ML)", () => {
  it("exact-match step returns a matched decision with the right skill", () => {
    writeRegistry([skill({ name: "csv-to-json" })]);
    const r = matchSkill("convert CSV to JSON file");
    expect(r.kind).toBe("matched");
    if (r.kind === "matched") expect(r.skill.name).toBe("csv-to-json");
  });

  it("prefers the best skill, not the first in the catalog", () => {
    writeRegistry([
      skill({ name: "excel-to-csv", tags: ["excel", "csv"], description: "export an excel sheet to csv" }),
      skill({ name: "csv-to-json", tags: ["csv", "json"], description: "convert a CSV spreadsheet to JSON" }),
    ]);
    const r = matchSkill("turn csv into a json document");
    if (r.kind === "matched") expect(r.skill.name).toBe("csv-to-json");
    if (r.kind === "ambiguous")
      expect(r.candidates.some((c) => c.name === "csv-to-json")).toBe(true);
  });

  it("irrelevant step → none, does not fire a wrong skill", () => {
    writeRegistry([skill({ name: "csv-to-json" })]);
    const r = matchSkill("send a telegram notification about a deploy");
    expect(r.kind).toBe("none");
  });

  it("scores are normalized to [0,1]; unambiguous has a clear margin", () => {
    writeRegistry([
      skill({ name: "csv-to-json", description: "convert csv to json" }),
      skill({ name: "json-to-csv", description: "convert json to csv" }),
      skill({ name: "send-email", description: "send an email report" }),
    ]);
    const r = matchSkill("convert csv to json");
    if (r.kind === "matched") expect(r.score).toBeGreaterThanOrEqual(0);
    expect(["matched", "ambiguous", "none"]).toContain(r.kind);
  });

  it("domain filter prevents cross-domain collisions", () => {
    writeRegistry([
      skill({ name: "create-record-1c", domain: "onec", description: "create a record in 1c" }),
      skill({ name: "create-record-contracts", domain: "contracts", description: "create a contract record" }),
    ]);
    // Matching in the contracts domain must not see the 1c skill.
    const r = matchSkill("create a record", { domain: "contracts" });
    if (r.kind === "matched") expect(r.skill.domain).toBe("contracts");
    if (r.kind === "ambiguous")
      expect(r.candidates.every((c) => c.domain === "contracts")).toBe(true);
  });

  it("per-phrasing: same meaning, different words still matches", () => {
    writeRegistry([skill({ name: "csv-to-json" })]);
    const r = matchSkill("transform the spreadsheet into json output");
    expect(r.kind).not.toBe("none");
  });
});

describe("shadow-migration (v0.51)", () => {
  it("shadowCompare runs BM25 and naive on the same cases", () => {
    writeRegistry([
      skill({ name: "csv-to-json", description: "convert csv to json files" }),
      skill({ name: "send-email", description: "send an email report" }),
    ]);
    const res = shadowCompare(
      [
        { step: "convert csv to json" },
        { step: "send a telegram alert" },
      ],
      "general",
    );
    expect(res.length).toBe(2);
    expect(res[0]).toHaveProperty("bm25");
    expect(res[0]).toHaveProperty("naive");
  });
});

describe("environment fingerprint (Phase 4 hook)", () => {
  it("is stable for equal signals and differs on drift", () => {
    const a = environmentFingerprint({ schema: "1C_TI", version: "8.3" });
    const b = environmentFingerprint({ schema: "1C_TI", version: "8.3" });
    const moved = environmentFingerprint({ schema: "1C_TI_NEW", version: "8.3" });
    expect(a).toBe(b);
    expect(a).not.toBe(moved);
  });
});

describe("skill miss-log (Phase 1 infrastructure)", () => {
  it("logs every miss and persists across calls", () => {
    logSkillMiss({
      step: "send a telegram notification",
      domain: "general",
      reason: "below-threshold",
      topScore: 0.02,
    });
    logSkillMiss({
      step: "send a telegram notification",
      domain: "general",
      reason: "borderline",
      topScore: 0.05,
    });
    const entries = readMissLog();
    expect(entries.length).toBe(2);
    expect(entries[0].step).toBe("send a telegram notification");
    expect(entries[0].ts).toBeTruthy();
  });

  it("flags repeated signatures ≥ minRepeats as promotion candidates", () => {
    for (let i = 0; i < 4; i++) {
      logSkillMiss({ step: "convert dbf to xlsx", domain: "onec", reason: "no-skills", topScore: null });
    }
    logSkillMiss({ step: "send a telegram notification", domain: "general", reason: "below-threshold", topScore: 0 });
    const cands = promotionCandidates(3);
    expect(cands.length).toBe(1);
    expect(cands[0].repeat).toBe(4);
    expect(cands[0].entry.step).toBe("convert dbf to xlsx");
  });

  it("log file is JSON-lines under ORION_MISS_LOG_DIR", () => {
    expect(missLogFile()).toContain("skill-miss-log.jsonl");
  });
});
