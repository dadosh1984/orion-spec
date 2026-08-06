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
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("shield skill", () => {
  it("reports FAIL when the security scan finds eval()", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync("src/tasks/bad.ts", 'export const x = eval("1+1");', "utf8");
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("FAIL");
    expect(report.allPass).toBe(false);
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
