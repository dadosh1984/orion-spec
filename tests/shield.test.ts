import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shield } from "../src/skills/shield/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-shield-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_SHIELD_SKIP_SHELL = "1";
  // shield() fails honestly when the change does not exist (v0.10), so the
  // fixture change must exist for every test.
  mkdirSync(join("changes", "demo"), { recursive: true });
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("shield skill", () => {
  it("throws when the change does not exist (honesty, v0.10)", async () => {
    await expect(shield("missing")).rejects.toThrow(/not found/);
  });

  it("records the context hash snapshot in the report (v0.10)", async () => {
    const report = await shield("demo", { noCache: true });
    expect(report.contextHash).toMatch(/^[0-9a-f]{12}$/);
  });

  it("reports FAIL when the security scan finds eval()", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync("src/tasks/bad.ts", 'export const x = eval("1+1");', "utf8");
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("FAIL");
    expect(report.allPass).toBe(false);
  });

  it("security scan catches shell injection, vm and hardcoded secrets", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      "src/tasks/ci.ts",
      'import { execSync } from "node:child_process";\n' +
        "export const run = (cmd: string) => execSync(`echo ${cmd}`);",
      "utf8",
    );
    writeFileSync(
      "src/tasks/sandbox.ts",
      'import vm from "node:vm";\nvm.runInNewContext(code, {});',
      "utf8",
    );
    writeFileSync(
      "src/tasks/creds.ts",
      'export const API_KEY = "sk-abcdefghijklmnopqrstuvwxyz123456";',
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("FAIL");
    expect(security?.detail).toContain("child_process");
    expect(security?.detail).toContain("interpolated variable");
    expect(security?.detail).toContain("node:vm");
    expect(security?.detail).toContain("hardcoded credential");
  });

  it("security scan stays green on legitimate template literals", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      "src/tasks/ok.ts",
      "export const greet = (name: string) => `hello ${name}!`;",
      "utf8",
    );
    writeFileSync(
      "src/tasks/fs.ts",
      "export const save = (p: string, s: string) => fs.writeFileSync(p, s);",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("PASS");
  });

  it("drift check flags capabilities missing from src/tasks", async () => {
    mkdirSync(join("changes", "demo", "specs", "core"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "core", "spec.md"),
      "# Spec: converter\n\n## Purpose\nx\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const drift = report.checks.find((c) => c.step === "drift");
    expect(drift?.status).toBe("FAIL");
  });

  it("drift check passes when the capability is implemented", async () => {
    mkdirSync(join("changes", "demo", "specs", "core"), { recursive: true });
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "core", "spec.md"),
      "# Spec: converter\n\n## Purpose\nx\n",
      "utf8",
    );
    writeFileSync(
      "src/tasks/converter.ts",
      "export function converter() { return 1; }",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const drift = report.checks.find((c) => c.step === "drift");
    expect(drift?.status).toBe("PASS");
  });

  it("writes guard-report.md and guard-report.json", async () => {
    const report = await shield("demo", { noCache: true });
    expect(existsSync(join("reports", "demo", "guard-report.md"))).toBe(true);
    expect(existsSync(join("reports", "demo", "guard-report.json"))).toBe(true);
    const md = readFileSync(join("reports", "demo", "guard-report.md"), "utf8");
    expect(md).toContain("Guard Report");
    expect(report.changeId).toBe("demo");
  });

  it("caches PASS only while the project hash is unchanged", async () => {
    mkdirSync(join("changes", "demo", "specs", "core"), { recursive: true });
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "core", "spec.md"),
      "# Spec: converter\n\n## Purpose\nx\n",
      "utf8",
    );
    writeFileSync(
      "src/tasks/converter.ts",
      "export function converter() { return 1; }",
      "utf8",
    );

    const first = await shield("demo", { noCache: false });
    expect(first.checks.find((c) => c.step === "drift")?.status).toBe("PASS");

    // Same code → cached PASS is honoured (SKIP).
    const second = await shield("demo", { noCache: false });
    expect(second.checks.find((c) => c.step === "drift")?.status).toBe("SKIP");

    // Hand edit → hash changed → the step is honestly re-run.
    writeFileSync(
      "src/tasks/converter.ts",
      "export function converter() { return 2; }",
      "utf8",
    );
    const third = await shield("demo", { noCache: false });
    const drift3 = third.checks.find((c) => c.step === "drift");
    expect(drift3?.status).toBe("PASS");
    expect(drift3?.detail).toContain("matched");
  });

  it("drift ignores stray mentions (comments) — exports only", async () => {
    mkdirSync(join("changes", "demo", "specs", "core"), { recursive: true });
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "core", "spec.md"),
      "# Spec: converter\n\n## Purpose\nx\n",
      "utf8",
    );
    // "converter" only appears in a comment, not as an export → drift FAIL.
    writeFileSync(
      "src/tasks/other.ts",
      "// TODO: implement the converter here\nexport function helper() { return 1; }",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const drift = report.checks.find((c) => c.step === "drift");
    expect(drift?.status).toBe("FAIL");
    expect(drift?.detail).toContain("converter");
  });

  it("detects the package manager and derives shell commands from context", async () => {
    const { detectPackageManager, stepCommand } =
      await import("../src/skills/shield/handler.js");
    // No lockfile → npm default; no scripts → lint/test are null (SKIP).
    expect(detectPackageManager()).toBe("npm");
    expect(stepCommand("lint")).toBeNull();
    expect(stepCommand("test")).toBeNull();
    expect(stepCommand("type")).toBe("npm exec tsc --noEmit");

    writeFileSync("pnpm-lock.yaml", "lockfileVersion: '9.0'\n", "utf8");
    writeFileSync(
      "package.json",
      JSON.stringify({ scripts: { lint: "eslint .", test: "vitest run" } }),
      "utf8",
    );
    expect(detectPackageManager()).toBe("pnpm");
    expect(stepCommand("lint")).toBe("pnpm run lint");
    expect(stepCommand("test")).toBe("pnpm test");

    // yaml lock wins only when pnpm-lock.yaml is gone.
    rmSync("pnpm-lock.yaml");
    writeFileSync("yarn.lock", "# yarn\n", "utf8");
    writeFileSync(
      "package.json",
      JSON.stringify({ scripts: { typecheck: "tsc" } }),
      "utf8",
    );
    expect(detectPackageManager()).toBe("yarn");
    expect(stepCommand("type")).toBe("yarn run typecheck");
  });
});
