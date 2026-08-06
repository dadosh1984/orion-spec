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
import { out } from "../src/skills/out/handler.js";
import { hashFile } from "../src/utils/hash.js";
import {
  readJson,
  writeJson,
  writeFileSafe,
  exists,
} from "../src/utils/file.js";
import { applyScale } from "../src/core/scale.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-misc-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("out skill", () => {
  it("writes result.md with the guard verdict", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.allPass).toBe(true);
    expect(existsSync(join("changes", "demo", "result.md"))).toBe(true);
    expect(
      readFileSync(join("changes", "demo", "result.md"), "utf8"),
    ).toContain("SUCCESS");
  });

  it("reports INCOMPLETE when no guard report exists", async () => {
    mkdirSync(join("changes", "ghost"), { recursive: true });
    const result = await out("ghost");
    expect(result.allPass).toBe(false);
    expect(
      readFileSync(join("changes", "ghost", "result.md"), "utf8"),
    ).toContain("INCOMPLETE");
  });

  it("marks INCOMPLETE when tasks are left open despite a PASS guard", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n- [ ] two\n",
      "utf8",
    );
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.status).toBe("INCOMPLETE");
    expect(result.tasksDone).toBe(1);
    expect(result.tasksTotal).toBe(2);
    expect(result.allPass).toBe(false);
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("1/2");
    expect(md).toContain("## Checklist");
    expect(md).toContain("orion forge demo");
  });

  it("lists artifacts and SUCCESS when guard passes and all tasks done", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n",
      "utf8",
    );
    writeFileSync(join("changes", "demo", "proposal.md"), "# P\n", "utf8");
    mkdirSync(join("changes", "demo", "specs", "core"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "specs", "core", "spec.md"),
      "# Spec: x\n",
      "utf8",
    );
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.status).toBe("SUCCESS");
    expect(result.allPass).toBe(true);
    expect(result.artifacts).toContain("changes/demo/proposal.md");
    expect(result.artifacts).toContain("changes/demo/specs/core/spec.md");
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("ready to archive");
    expect(md).toContain("## Artifacts");
  });

  it("throws when the change does not exist (honesty, v0.10)", async () => {
    await expect(out("missing-change")).rejects.toThrow(/not found/);
  });

  it("marks a stale guard verdict STALE and INCOMPLETE (v0.10)", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n",
      "utf8",
    );
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
        // Hash that can never match the current context.
        contextHash: "deadbeef",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.staleGuard).toBe(true);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.allPass).toBe(false);
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("STALE");
    expect(md).toContain("Re-run it");
  });

  it("says freshness is unknown for legacy reports without a snapshot (v0.10)", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n",
      "utf8",
    );
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: "2025-01-01T00:00:00.000Z",
      }),
      "utf8",
    );
    const result = await out("demo");
    expect(result.staleGuard).toBe(false);
    // Legacy verdict is not called stale, but it is not presented as truth
    // either — the report says to re-run shield for a definitive verdict.
    const md = readFileSync(join("changes", "demo", "result.md"), "utf8");
    expect(md).toContain("legacy report without a freshness snapshot");
    expect(result.status).toBe("SUCCESS");
  });

  it("does not make the guard stale by writing result.md itself (v0.10)", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n",
      "utf8",
    );
    const { projectHash } = await import("../src/skills/shield/handler.js");
    const hash = projectHash("demo");
    mkdirSync(join("reports", "demo"), { recursive: true });
    writeFileSync(
      join("reports", "demo", "guard-report.json"),
      JSON.stringify({
        changeId: "demo",
        checks: [{ step: "security", status: "PASS" }],
        allPass: true,
        generatedAt: new Date().toISOString(),
        contextHash: hash,
      }),
      "utf8",
    );
    const first = await out("demo");
    expect(first.staleGuard).toBe(false);
    expect(first.status).toBe("SUCCESS");
    // result.md now exists (and was regenerated) — a second run must still
    // see the guard as fresh, otherwise every out would poison the verdict.
    const second = await out("demo");
    expect(second.staleGuard).toBe(false);
    expect(second.status).toBe("SUCCESS");
  });
});

describe("utils", () => {
  it("hashFile computes the sha256 of a file", async () => {
    writeFileSync("a.txt", "hello", "utf8");
    const hash = await hashFile("a.txt");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashFile("a.txt"));
  });

  it("writeJson / readJson round-trip", async () => {
    await writeJson("data.json", { a: 1 });
    expect(await readJson<{ a: number }>("data.json")).toEqual({ a: 1 });
    expect(await readJson("missing.json")).toBeNull();
  });

  it("exists() reflects filesystem state", async () => {
    expect(exists("nope")).toBe(false);
    await writeFileSafe("x.txt", "x");
    expect(exists("x.txt")).toBe(true);
  });
});

describe("scale caching", () => {
  it("stores intermediate results in the cache", async () => {
    const code = `import { join } from 'path';\nconst x = () => { return 1; };\n`;
    await applyScale(code, { noCache: true });
    // Second run with cache enabled should hit stored entries.
    const out1 = await applyScale(code);
    const track = new OrionTrack(join(dir, "cache"));
    const stats = track.getStats();
    expect(stats.count).toBeGreaterThan(0);
    expect(out1).toContain("from 'node:path'");
  });
});

describe("scale via main()", () => {
  it("writes the scaled output next to the input file", async () => {
    const { main } = await import("../src/cli/commands.js");
    writeFileSync("a.ts", "import { readFileSync } from 'fs';\n", "utf8");
    expect(await main(["scale", "a.ts"])).toBe(0);
    expect(existsSync("a.scaled.ts")).toBe(true);
    expect(readFileSync("a.scaled.ts", "utf8")).toContain("from 'node:fs'");
  });
});

describe("capability manifests (drift-gate proof, v0.12–v0.14)", () => {
  it("every # Spec: capability has a real exported manifest", async () => {
    const node = await import("../src/tasks/node.js");
    const self = await import("../src/tasks/self.js");
    const session = await import("../src/tasks/session.js");
    const template = await import("../src/tasks/template.js");
    const compress = await import("../src/tasks/compress.js");
    const lessons = await import("../src/tasks/lessons.js");
    const yagni = await import("../src/tasks/yagni.js");
    const sessionMetrics = await import("../src/tasks/session-metrics.js");
    const waves = await import("../src/tasks/waves.js");
    const economy = await import("../src/tasks/economy.js");
    expect(node.node).toBeDefined();
    expect(self.self).toBe("self-correction");
    expect(session.session).toBe("session-learning");
    expect(template.template).toBeDefined();
    expect(compress.compress).toBe("token-economy");
    expect(lessons.lessons).toBe("lessons-in-result");
    expect(yagni.yagni).toBe("warn-signal");
    expect(sessionMetrics.sessionMetrics).toBe("per-role-breakdown");
    expect(waves.waves).toBe("parallel-forge-waves");
    expect(economy.economy).toBe("budget-warn");
    // contracts carry the honest capability description
    expect(compress.compressContract.description).toMatch(/≈ bytes\/4/);
    expect(lessons.lessonsContract.description).toMatch(/Уроков нет|нет уроков/);
    expect(yagni.yagniContract.description).toMatch(/WARN/);
    expect(waves.wavesContract.description).toMatch(/--parallel/);
    expect(economy.economyContract.description).toMatch(/economy step/);
  });
});
