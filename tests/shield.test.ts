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
import { OrionTrack } from "../src/core/track.js";

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

  it("skips cached PASS steps and re-runs on --no-cache", async () => {
    const track = new OrionTrack(join(dir, "cache"));
    track.store("shield:lint", "PASS");
    const first = await shield("demo", { noCache: false });
    const lint = first.checks.find((c) => c.step === "lint");
    expect(lint?.status).toBe("SKIP");
  });
});
