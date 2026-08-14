import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  logSkillUse,
  logSkillMiss,
  readSkillUsage,
  skillUsageStats,
  resetMissLogPath,
} from "../src/core/skillMissLog.js";

const ORIG = process.env.ORION_MISS_LOG_DIR;
let dir: string;

beforeEach(() => {
  dir = join(tmpdir(), `orion-metrics-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  process.env.ORION_MISS_LOG_DIR = dir;
});

afterEach(() => {
  resetMissLogPath();
  delete process.env.ORION_MISS_LOG_DIR;
  if (ORIG) process.env.ORION_MISS_LOG_DIR = ORIG;
  rmSync(dir, { recursive: true, force: true });
});

describe("skill-metrics (ROI from day one)", () => {
  it("starts at zero when nothing logged", () => {
    expect(readSkillUsage()).toEqual({ via_skill: 0, via_llm: 0 });
    expect(skillUsageStats()).toEqual({
      via_skill: 0,
      via_llm: 0,
      saved_steps: 0,
    });
  });

  it("logSkillUse increments via_skill but not via_llm", () => {
    logSkillUse();
    logSkillUse();
    expect(readSkillUsage().via_skill).toBe(2);
  });

  it("logSkillMiss tail→ via_llm from the miss-log length", () => {
    logSkillMiss({ step: "создать запись", domain: "onec", reason: "below-threshold", topScore: 0.1 });
    logSkillMiss({ step: "другой шаг", domain: "general", reason: "no-skills", topScore: null });
    expect(skillUsageStats().via_llm).toBe(2);
  });

  it("saved_steps = via_skill − via_llm (not below zero)", () => {
    logSkillUse();
    logSkillUse();
    logSkillUse();
    logSkillMiss({ step: "x", domain: "general", reason: "below-threshold", topScore: 0.2 });
    const s = skillUsageStats();
    expect(s.via_skill).toBe(3);
    expect(s.via_llm).toBe(1);
    expect(s.saved_steps).toBe(2);
  });
});
