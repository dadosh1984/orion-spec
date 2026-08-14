import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchSkill } from "../src/core/skillsMatch.js";

const ORIG_SCRIPTS = process.env.ORION_SCRIPTS_DIR;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-domdrift-"));
  process.env.ORION_SCRIPTS_DIR = dir;
  // a skill dir under "records" with domain=contracts; none under marketing
  const skillDir = join(dir, "create-record");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "orion.json"),
    JSON.stringify({
      name: "create-record",
      description: "create a record in the contracts system",
      domain: "contracts",
      runCount: 0,
    }),
    "utf8",
  );
  writeFileSync(join(skillDir, "run.js"), "console.log('ok')", "utf8");
});

afterEach(() => {
  delete process.env.ORION_SCRIPTS_DIR;
  if (ORIG_SCRIPTS) process.env.ORION_SCRIPTS_DIR = ORIG_SCRIPTS;
  rmSync(dir, { recursive: true, force: true });
});

describe("C2 — domain-drift warning (no silent fallback)", () => {
  it("warns on stderr when a declared domain has no skills, then falls back to general", () => {
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const r = matchSkill("some step", { domain: "marketing" });
    const warnedMsgs = err.mock.calls.map((c) => String(c[0])).join("");
    expect(warnedMsgs).toContain('Domain "marketing"');
    expect(warnedMsgs).toContain("no skills found for it");
    expect(r.kind).toBe("none"); // no matching scripts in general either
    err.mockRestore();
  });

  it("does NOT warn for the general domain (it is the empty-fallback itself)", () => {
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    matchSkill("some step", { domain: "general" });
    const warned = err.mock.calls.join("").toString();
    expect(warned).not.toContain('Domain "general"');
    err.mockRestore();
  });

  it("does NOT warn when the declared domain has matching skills", () => {
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const r = matchSkill("contracts create record system", {
      domain: "contracts",
    });
    expect(r.kind).toBe("matched");
    const warned = err.mock.calls.join("").toString();
    expect(warned).not.toContain("no skills found for it");
    err.mockRestore();
  });

  it("warns via the actual resolved domain (no explicit domain passed)", () => {
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    // resolveDomain reads config/env; here ORION_DOMAIN=marketing is unset,
    // so it resolves to general — no warn expected for the default case.
    matchSkill("some step");
    const warned = err.mock.calls.join("").toString();
    expect(warned).not.toContain('Domain ""'); // not a misleading empty-name warn
    err.mockRestore();
  });
});
