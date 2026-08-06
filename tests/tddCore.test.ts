import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TddEngine, State } from "../src/core/tddCore.js";
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
});
