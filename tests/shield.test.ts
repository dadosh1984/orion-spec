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
import { shield, verifiabilityCheck } from "../src/skills/shield/handler.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-shield-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
  process.env.ORION_SHIELD_SKIP_SHELL = "1";
  process.env.ORION_DEBT_FILE = join(dir, "debt.json");
  // shield() fails honestly when the change does not exist (v0.10), so the
  // fixture change must exist for every test.
  mkdirSync(join("changes", "demo"), { recursive: true });
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
  delete process.env.ORION_DEBT_FILE;
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

  it("security scan ignores eval/process.env mentioned only in comments or strings", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      "src/tasks/comment.ts",
      [
        "// never call eval( in production",
        "/* new Function( is banned here */",
        "// process.env.KEY is read at boot",
        "export const ok = () => 1;",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      "src/tasks/string.ts",
      'export const msg = "eval( is dangerous and new Function( too";',
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("PASS");
  });

  it("security scan still catches real eval after a preceding comment mention", async () => {
    mkdirSync("src/tasks", { recursive: true });
    writeFileSync(
      "src/tasks/mixed.ts",
      [
        "// do not eval( user input",
        "export const run = (code: string) => eval(code);",
      ].join("\n"),
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const security = report.checks.find((c) => c.step === "security");
    expect(security?.status).toBe("FAIL");
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

describe("shield: yagni signal (v0.15)", () => {
  it("WARNs on a snippet far above the repo median — and stays allPass", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync(
      "src/base.ts",
      "export const a = 1;\nexport const b = 2;\n",
      "utf8",
    );
    mkdirSync("changes/demo/snippets", { recursive: true });
    const big = Array.from(
      { length: 220 },
      (_, i) => `const v${i} = ${i};`,
    ).join("\n");
    writeFileSync(
      "changes/demo/snippets/big.ts",
      big + "\nexport const big = 1;\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const yagni = report.checks.find((c) => c.step === "yagni");
    expect(yagni?.status).toBe("WARN");
    expect(yagni?.detail).toMatch(/vs median 2 \(/);
    expect(yagni?.detail).toContain("big.ts");
    // WARN is a signal, not a gate: allPass stays true
    expect(report.allPass).toBe(true);
  });

  it("PASSes when snippets are within repo norms", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync(
      "src/base.ts",
      "export const a = 1;\nexport const b = 2;\n",
      "utf8",
    );
    mkdirSync("changes/demo/snippets", { recursive: true });
    writeFileSync(
      "changes/demo/snippets/small.ts",
      "export const s = 1;\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const yagni = report.checks.find((c) => c.step === "yagni");
    expect(yagni?.status).toBe("PASS");
    expect(yagni?.detail).toContain("within repo norms");
  });

  it("PASSes with an honest reason when there are no snippets", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync("src/base.ts", "export const a = 1;\n", "utf8");
    const report = await shield("demo", { noCache: true });
    const yagni = report.checks.find((c) => c.step === "yagni");
    expect(yagni?.status).toBe("PASS");
    expect(yagni?.detail).toContain("no snippets to check");
  });

  it("SKIPs honestly when there is no repo baseline", async () => {
    const report = await shield("demo", { noCache: true });
    const yagni = report.checks.find((c) => c.step === "yagni");
    expect(yagni?.status).toBe("SKIP");
    expect(yagni?.detail).toContain("no existing .ts sources");
  });
});

describe("shield: economy step (v0.17)", () => {
  function smallBudget(bytes: number): void {
    // track config lives at src/config/orionTrack.json (resolveConfig)
    mkdirSync(join("src", "config"), { recursive: true });
    writeFileSync(
      join("src", "config", "orionTrack.json"),
      JSON.stringify({ maxSize: bytes, ttlDays: 30 }),
      "utf8",
    );
  }

  it("WARNs above 60% of the cache budget and keeps allPass", async () => {
    smallBudget(1000); // 60% = 600 B
    const track = OrionTrack.init();
    for (let i = 0; i < 5; i++) {
      track.store(`key-${i}`, "x".repeat(300)); // ~1750 B total > 600 B
    }
    const report = await shield("demo", { noCache: true });
    const eco = report.checks.find((c) => c.step === "economy");
    expect(eco?.status).toBe("WARN");
    expect(eco?.detail).toContain("above 60% of budget");
    expect(eco?.detail).toContain("consider orion track prune");
    expect(report.allPass).toBe(true);
  });

  it("PASSes within budget with honest numbers", async () => {
    smallBudget(10_000);
    const track = OrionTrack.init();
    track.store("tiny", "ok");
    const report = await shield("demo", { noCache: true });
    const eco = report.checks.find((c) => c.step === "economy");
    expect(eco?.status).toBe("PASS");
    expect(eco?.detail).toContain("within budget");
  });

  it("PASSes honestly when the cache is empty", async () => {
    smallBudget(10_000);
    const report = await shield("demo", { noCache: true });
    const eco = report.checks.find((c) => c.step === "economy");
    expect(eco?.status).toBe("PASS");
    expect(eco?.detail).toContain("cache is empty");
  });

  it("is never cache-cached — a second run re-checks live state", async () => {
    smallBudget(10_000);
    const track = OrionTrack.init();
    track.store("a", "x");
    await shield("demo"); // run 1: PASS, cached hash
    // grow the cache above budget, same source hash
    smallBudget(100);
    for (let i = 0; i < 5; i++) track.store(`grow-${i}`, "y".repeat(200));
    const report = await shield("demo"); // run 2: must see the growth
    const eco = report.checks.find((c) => c.step === "economy");
    expect(eco?.status).toBe("WARN");
  });

  it("adds a verifiability step that WARNs on low verifiability (empty repo)", async () => {
    const report = await shield("demo", { noCache: true });
    const v = report.checks.find((c) => c.step === "verifiability");
    expect(v).toBeDefined();
    expect(v?.status).toBe("WARN");
    expect(v?.detail).toContain("level 0");
  });

  it("reports PASS verifiability when the repo has a test runner + real assertions", () => {
    writeFileSync("vitest.config.ts", "export default {}", "utf8");
    mkdirSync("tests", { recursive: true });
    writeFileSync(
      "tests/a.test.ts",
      "import { it, expect } from 'vitest';\nit('a', () => expect(1).toBe(1));\n",
      "utf8",
    );
    const v = verifiabilityCheck();
    expect(v.status).toBe("PASS");
    expect(v.detail).toContain("level 3");
  });
});

describe("shield: policy gate (v0.23)", () => {
  it("FAILs when a denied package is imported", async () => {
    mkdirSync(join(".orion"), { recursive: true });
    writeFileSync(
      join(".orion", "policy.json"),
      JSON.stringify({ denyImport: ["lodash"] }),
      "utf8",
    );
    mkdirSync(join("src"), { recursive: true });
    writeFileSync(
      join("src", "evil.ts"),
      "import lodash from 'lodash';\nexport const x = lodash.get({}, 'a');\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const policy = report.checks.find((c) => c.step === "policy");
    expect(policy?.status).toBe("FAIL");
    expect(policy?.detail).toContain("lodash");
  });

  it("PASSes when no policy.json exists (no gates to enforce)", async () => {
    const report = await shield("demo", { noCache: true });
    const policy = report.checks.find((c) => c.step === "policy");
    expect(policy?.status).toBe("PASS");
    expect(policy?.detail).toContain("no .orion/policy.json");
  });

  it("FAILs when a denied regex pattern matches the change's snippets", async () => {
    mkdirSync(join(".orion"), { recursive: true });
    writeFileSync(
      join(".orion", "policy.json"),
      JSON.stringify({ denyPattern: ["process\.env\.AWS_"] }),
      "utf8",
    );
    mkdirSync(join("changes", "demo", "snippets"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "snippets", "task-a.ts"),
      "const key = process.env.AWS_SECRET_KEY;\n",
      "utf8",
    );
    const report = await shield("demo", { noCache: true });
    const policy = report.checks.find((c) => c.step === "policy");
    expect(policy?.status).toBe("FAIL");
    expect(policy?.detail).toContain("pattern");
  });
});
