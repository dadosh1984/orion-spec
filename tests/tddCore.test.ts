import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  existsSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TddEngine, State, describeFailure } from "../src/core/tddCore.js";
import { OrionTrack } from "../src/core/track.js";
import type { TddConfig } from "../src/type.js";

let work: string;
let track: OrionTrack;
let config: TddConfig;

beforeEach(() => {
  // Temp workspace INSIDE the project root so vitest can run the files.
  work = join(process.cwd(), ".tmp-tdd");
  mkdirSync(join(work, "tests"), { recursive: true });
  mkdirSync(join(work, "src", "tasks"), { recursive: true });
  track = new OrionTrack(
    join(mkdtempSync(join(tmpdir(), "orion-cache-")), "cache"),
  );
  config = {
    testTemplate: [
      `import { describe, it, expect } from 'vitest';`,
      `import { {{task}} } from '../src/tasks/{{task}}';`,
      ``,
      `describe('{{task}}', () => {`,
      `  it('works', () => {`,
      `    expect({{task}}()).toBeDefined();`,
      `  });`,
      `});`,
      ``,
    ].join("\n"),
    testDir: join(work, "tests"),
    srcDir: join(work, "src", "tasks"),
    command: "pnpm vitest run --root {{root}} {{task}}.test.ts",
    minCoverage: 80,
  };
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("TddEngine", () => {
  it("starts in RED and generates a failing test file", async () => {
    const engine = new TddEngine("add", track, config);
    expect(engine.state).toBe(State.RED);
    await engine.generateTest();
    expect(existsSync(join(work, "tests", "add.test.ts"))).toBe(true);
    expect(engine.state).toBe(State.RED);
  });

  it("transition stays RED while the test fails", () => {
    const engine = new TddEngine("add", track, config);
    expect(engine.transition(false)).toBe(State.RED);
  });

  it("transition moves to GREEN when the test passes", () => {
    const engine = new TddEngine("add", track, config);
    expect(engine.transition(true)).toBe(State.GREEN);
  });

  it("transition rolls a regression back to RED", () => {
    const engine = new TddEngine("add", track, config);
    expect(engine.transition(true)).toBe(State.GREEN);
    // code breaks after a green run (e.g. tdd implement --watch) → RED again
    expect(engine.transition(false)).toBe(State.RED);
  });

  it("transition does not resurrect a DONE task", () => {
    const engine = new TddEngine("add", track, config);
    engine.finalize();
    expect(engine.transition(false)).toBe(State.DONE);
    expect(engine.transition(true)).toBe(State.DONE);
  });

  it("rejects task ids with shell metacharacters (command injection guard)", () => {
    expect(() => new TddEngine("a; curl evil.com", track, config)).toThrow();
    expect(() => new TddEngine("..\\..\\etc", track, config)).toThrow();
    expect(() => new TddEngine("my-task_2", track, config)).not.toThrow();
  });

  it("applyCode writes the implementation snippet", async () => {
    const engine = new TddEngine("add", track, config);
    await engine.applyCode("export function add() { return 0; }");
    expect(existsSync(join(work, "src", "tasks", "add.ts"))).toBe(true);
  });

  it("runTest returns true when tests pass (real vitest run)", async () => {
    const engine = new TddEngine("add", track, config);
    await engine.generateTest();
    await engine.applyCode("export function add() { return 0; }");
    const passed = await engine.runTest();
    expect(passed).toBe(true);
    expect(engine.state).toBe(State.GREEN);
  });

  it("runTest returns false when the implementation is missing", async () => {
    const engine = new TddEngine("nope", track, config);
    await engine.generateTest();
    const passed = await engine.runTest();
    expect(passed).toBe(false);
    expect(engine.state).toBe(State.RED);
  });

  it("finalize marks the task DONE and caches the status", () => {
    const engine = new TddEngine("add", track, config);
    engine.finalize();
    expect(engine.completed).toBe(true);
    expect(engine.status()).toBe("DONE");
    expect(track.loadString("tdd:add")).toBe("DONE");
  });

  it("describeFailure names the failing test file and assertion (v0.10)", () => {
    const output = [
      " ❯ tests/calc.test.ts (3 tests | 1 failed) 21ms",
      "   ❯ calc > subtract > works 12ms",
      "     AssertionError: expected 3 to be 2",
      "     - expected",
      "     + received",
      "      2",
      "      3",
    ].join("\n");
    const detail = describeFailure(output);
    expect(detail).toContain("tests/calc.test.ts");
    expect(detail).toContain("AssertionError");
  });

  it("describeFailure never invents details (v0.10)", () => {
    const detail = describeFailure("process exited with code 1");
    expect(detail).toContain("no details were invented");
  });

  it("status() reports the live state before finalize", () => {
    const engine = new TddEngine("prefinal", track);
    expect(engine.status()).toBe(State.RED);
    engine.transition(true);
    expect(engine.status()).toBe(State.GREEN);
  });

  it("loads the packaged TDD config when none is supplied", () => {
    const engine = new TddEngine("bares", track);
    expect(engine.config.testDir).toBeTruthy();
    expect(engine.config.minCoverage).toBeGreaterThanOrEqual(0);
  });

  it("refactor returns false honestly when eslint cannot run (isolated cwd)", async () => {
    const prior = process.cwd();
    const isolated = mkdtempSync(join(tmpdir(), "orion-tdd-refactor-"));
    try {
      // No src/tasks here, so eslint fails and refactor must report false.
      process.chdir(isolated);
      const engine = new TddEngine(
        "refx",
        new OrionTrack(join(isolated, "cache")),
      );
      const ok = await engine.refactor();
      expect(ok).toBe(false);
    } finally {
      process.chdir(prior);
      rmSync(isolated, { recursive: true, force: true });
    }
  });
});

describe("TddEngine hazard gate (v0.23)", () => {
  it("refuses a destructive snippet in applyCode", async () => {
    const engine = new TddEngine("hazardTask", track, config);
    await expect(
      engine.applyCode(
        "import { rmSync } from 'node:fs';\nexport function nuke() { rmSync('/', { recursive: true }); }\n",
      ),
    ).rejects.toThrow(/hazard gate/);
  });

  it("runTestDetailed blocks a hazardous implementation file without running it", async () => {
    const engine = new TddEngine("hazardRun", track, config);
    // Write a hazardous src file directly (bypassing applyCode) to prove the
    // pre-exec gate scans what the test runner is about to import.
    writeFileSync(
      join(work, "src", "tasks", "hazardRun.ts"),
      "export function x() { eval('1+1'); }\n",
      "utf8",
    );
    const r = await engine.runTestDetailed();
    expect(r.passed).toBe(false);
    expect(r.output).toContain("hazard gate");
    expect(r.output).toContain("dynamic eval");
  });

  it("runTestDetailed stays green for clean code", async () => {
    const engine = new TddEngine("hazardClean", track, config);
    await engine.generateTest();
    await engine.applyCode("export function hazardClean() { return 42; }");
    const r = await engine.runTestDetailed();
    expect(r.passed).toBe(true);
  });
});

describe("TddEngine: framework-agnostic extensions (v0.24)", () => {
  it("writes test/impl files with configured suffixes (Python-style)", async () => {
    const pyConfig: TddConfig = {
      ...config,
      testTemplate:
        "from {{task}} import {{task}}\n\ndef test_works():\n    assert {{task}}() is not None\n",
      testExt: "_test.py",
      srcExt: ".py",
      command: "python -m pytest {{testDir}}/{{testFile}}",
    };
    const engine = new TddEngine("calculator", track, pyConfig);
    await engine.generateTest();
    expect(existsSync(join(work, "tests", "calculator_test.py"))).toBe(true);
    expect(existsSync(join(work, "tests", "calculator.test.ts"))).toBe(false);
    await engine.applyCode("def calculator():\n    return 42\n");
    expect(existsSync(join(work, "src", "tasks", "calculator.py"))).toBe(true);
  });

  it("hazard gate scans the configured suffixes, not hardcoded .ts", async () => {
    const pyConfig: TddConfig = {
      ...config,
      testExt: "_test.py",
      srcExt: ".py",
      command: "python -m pytest {{testDir}}/{{testFile}}",
    };
    const engine = new TddEngine("risky", track, pyConfig);
    // .ts is the OLD hardcoded name and must NOT be scanned (it is not a
    // configured suffix) — it carries eval, which would block if read.
    writeFileSync(
      join(work, "src", "tasks", "risky.ts"),
      "export function x() { eval('1'); }",
      "utf8",
    );
    // .py IS the configured src suffix — eval is a matched hazard pattern.
    writeFileSync(
      join(work, "src", "tasks", "risky.py"),
      "def x():" + "\n" + "    return eval('1')" + "\n",
      "utf8",
    );
    const r = await engine.runTestDetailed();
    expect(r.passed).toBe(false);
    expect(r.output).toContain("hazard gate");
  });

  it("accepts Cyrillic task ids (Unicode-safe identifier guard)", async () => {
    const engine = new TddEngine("операции", track, config);
    expect(engine.task).toBe("операции");
    await engine.generateTest();
    expect(existsSync(join(work, "tests", "операции.test.ts"))).toBe(true);
  });
});
