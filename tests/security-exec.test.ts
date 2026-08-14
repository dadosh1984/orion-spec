import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { denyEnv, isDeniedEnvName } from "../src/core/denyEnv.js";

const ROOT = join(import.meta.dirname, "..");

function src(p: string): string {
  return readFileSync(join(ROOT, p), "utf8");
}

describe("denyEnv (3.13) — secrets never reach child script env", () => {
  it("strips GITHUB_TOKEN, AWS_*, *SECRET, *KEY, *PASSWORD from child env", () => {
    const raw: NodeJS.ProcessEnv = {
      GITHUB_TOKEN: "gh_xxx",
      AWS_SECRET_ACCESS_KEY: "aws_id",
      MY_API_KEY: "k123",
      DB_PASSWORD: "pwd",
      SAFE_VAR: "hello",
      PATH: "/usr/bin",
    };
    const out = denyEnv(raw);
    expect(out.GITHUB_TOKEN).toBeUndefined();
    expect(out.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(out.MY_API_KEY).toBeUndefined();
    expect(out.DB_PASSWORD).toBeUndefined();
    expect(out.SAFE_VAR).toBe("hello");
    expect(out.PATH).toBe("/usr/bin");
  });

  it("isDeniedEnvName matches the known deny patterns", () => {
    expect(isDeniedEnvName("GITHUB_TOKEN")).toBe(true);
    expect(isDeniedEnvName("AWS_SECRET_ACCESS_KEY")).toBe(true);
    expect(isDeniedEnvName("SOME_API_KEY")).toBe(true);
    expect(isDeniedEnvName("DB_PASSWORD")).toBe(true);
    expect(isDeniedEnvName("NODE_ENV")).toBe(false);
    expect(isDeniedEnvName("PATH")).toBe(false);
    expect(isDeniedEnvName("ORION_RUN_NAME")).toBe(false);
  });

  it("keeps an empty env empty (no fabrication)", () => {
    expect(denyEnv({})).toEqual({});
  });
});

describe("shell-injection (3.8) — child processes use argv, not interpolated strings", () => {
  it("runCmd.ts has no exec-family backtick call with a shell interpolation", () => {
    const rc = src("src/cli/runCmd.ts");
    // execSync/execFileSync backtick + `${` inside — the injection pattern.
    // A console.log/statusMark backtick is fine; only exec-family matters.
    expect(/exec(?:Sync|FileSync)?\([^`]*\$\{/.test(rc)).toBe(false);
  });

  it("runCmd.ts watcher runs CLI via spawnSync argv (no shell string)", () => {
    const rc = src("src/cli/runCmd.ts");
    expect(rc).toMatch(/spawnSync\(process\.execPath, \[cli, "run", wName\]/);
  });

  it("runCmd.ts repair re-forge is argv-safe (spawnSync)", () => {
    const rc = src("src/cli/runCmd.ts");
    expect(rc).toMatch(
      /spawnSync\(\s*process\.execPath,\s*\[cli, "forge", m\.sourceChange, "--save-as", name\]/s,
    );
  });

  it("runCmd.ts edit uses spawnSync with shell:false (editor parsed, no shell)", () => {
    const rc = src("src/cli/runCmd.ts");
    expect(rc).toMatch(/spawnSync\(bin, \[\.\.\.flags, scriptPath\(name\)\]/);
    expect(rc).toContain("shell: false");
  });
});
