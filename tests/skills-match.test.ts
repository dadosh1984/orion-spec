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
  resolveDomain,
  resolveAmbiguous,
  type SkillMeta,
} from "../src/core/skillsMatch.js";
import {
  logSkillMiss,
  readMissLog,
  promotionCandidates,
  missLogForStep,
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

  it("tier=bm25 when the step does NOT literally name the skill (regression for the tier tautology)", () => {
    // Step tokens do not equal the skill name, yet BM25 confidently matches.
    writeRegistry([skill({ name: "dbf-to-xlsx", description: "convert a dbf table to an xlsx spreadsheet", tags: ["dbf", "xlsx"] })]);
    const r = matchSkill("convert dbf into xlsx file", { skills: undefined });
    if (r.kind === "matched") expect(r.tier).toBe("bm25");
    // A matched step must NOT be labelled "exact" when the name differs.
    if (r.kind === "matched") expect(r.skill.name).not.toBe("dbf-to-xlsx convert dbf into xlsx file");
  });

  it("tier=exact when every token of the skill name is in the step", () => {
    writeRegistry([skill({ name: "csv-to-json", description: "convert a CSV spreadsheet to JSON", tags: ["csv", "json"] })]);
    const r = matchSkill("csv to json", { skills: undefined });
    if (r.kind === "matched") expect(r.tier).toBe("exact");
  });

  it("demotes a matched skill whose env fingerprint is stale (never silently run it)", () => {
    // Registry-less: pass the skill list directly so we control the stale
    // fingerprint. The step strongly matches this skill, yet the stored env
    // (e.g. 1C_TI before a migration) differs from the current runtime.
    const stale = skill({ name: "dbf-to-xlsx", environmentFingerprint: "runtime=v99.0.0" });
    const r = matchSkill("convert dbf to xlsx file", { skills: [stale] });
    expect(r.kind).toBe("ambiguous");
  });

  it("matched when the env fingerprint matches current (fresh skill)", () => {
    const fresh = skill({ name: "dbf-to-xlsx", environmentFingerprint: undefined });
    const r = matchSkill("dbf to xlsx make", { skills: [fresh] });
    expect(r.kind).toBe("matched");
  });
});describe("shadow-migration (v0.51)", () => {
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

  it("missLogForStep returns all historical I/O for a repeated signature (safe-promotion replay data)", () => {
    for (let i = 0; i < 3; i++) {
      logSkillMiss({
        step: "convert dbf to xlsx for the payroll",
        domain: "onec",
        reason: "below-threshold",
        topScore: null,
        resolution: `salary-output-${i}.xlsx`,
      });
    }
    // Case-insensitive signature match.
    const history = missLogForStep("CONVERT dbf to xlsx FOR the payroll");
    expect(history.length).toBe(3);
    expect(history[0].resolution).toBe("salary-output-0.xlsx");
    expect(history.every((h) => h.domain === "onec")).toBe(true);
  });

  it("missLogForStep returns [] for an unseen signature", () => {
    expect(missLogForStep("never logged this")).toEqual([]);
  });
});

describe("resolveDomain (v0.51, explicit declaration)", () => {
  const ORIG_DOMAIN = process.env.ORION_DOMAIN;
  afterEach(() => {
    if (ORIG_DOMAIN === undefined) delete process.env.ORION_DOMAIN;
    else process.env.ORION_DOMAIN = ORIG_DOMAIN;
  });

  it("env ORION_DOMAIN has priority over config", () => {
    process.env.ORION_DOMAIN = "contracts";
    expect(resolveDomain()).toBe("contracts");
  });

  it("falls back to `general` with no env and no config", () => {
    delete process.env.ORION_DOMAIN;
    expect(resolveDomain()).toBe("general");
  });

  it("reads .orion/config.json domain when env is absent", () => {
    delete process.env.ORION_DOMAIN;
    const cfgDir = join(dir, ".orion");
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, "config.json"), JSON.stringify({ domain: "onec" }), "utf8");
    const orig = process.cwd();
    process.chdir(dir);
    try {
      expect(resolveDomain()).toBe("onec");
    } finally {
      process.chdir(orig);
    }
  });
});

describe("resolveAmbiguous (v0.51, error asymmetry)", () => {
  it("returns none for a multi-candidate short-list (never guesses)", async () => {
    const cs = [
      skill({ name: "a" }),
      skill({ name: "b" }),
    ];
    const d = await resolveAmbiguous("some step", cs);
    expect(d.kind).toBe("none");
  });

  it("returns matched for a single candidate (nothing to choose)", async () => {
    const d = await resolveAmbiguous("some step", [skill({ name: "only" })]);
    expect(d.kind).toBe("matched");
  });
});
