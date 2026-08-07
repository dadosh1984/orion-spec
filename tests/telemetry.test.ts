import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  trace,
  readTraces,
  tracesPath,
  telemetryEnabled,
} from "../src/core/telemetry.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-telemetry-"));
  process.chdir(dir);
  process.env.ORION_TRACES_FILE = join(dir, "traces.jsonl");
  delete process.env.ORION_TELEMETRY;
});

afterEach(() => {
  delete process.env.ORION_TRACES_FILE;
  delete process.env.ORION_TELEMETRY;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("telemetry (v0.22)", () => {
  it("is a strict no-op unless ORION_TELEMETRY=1", () => {
    expect(telemetryEnabled()).toBe(false);
    trace({ type: "cache_hit", key: "k" });
    expect(existsSync(tracesPath())).toBe(false);
    expect(readTraces()).toEqual([]);
  });

  it("appends one JSON line per event when enabled, stamping ts", () => {
    process.env.ORION_TELEMETRY = "1";
    expect(telemetryEnabled()).toBe(true);
    trace({ type: "cache_hit", key: "k", savedBytes: 42 });
    trace({ type: "tdd", state: "RED", task: "task-x" });
    const events = readTraces();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("cache_hit");
    expect(events[0].savedBytes).toBe(42);
    expect(typeof events[0].ts).toBe("string");
    expect(events[1].type).toBe("tdd");
    expect(events[1].state).toBe("RED");
    // append-only: a third event does not rewrite earlier lines
    trace({ type: "transition", changeId: "c" });
    expect(readTraces()).toHaveLength(3);
  });

  it("is fail-safe: corrupt file reads as [] and writes never throw", () => {
    process.env.ORION_TELEMETRY = "1";
    writeFileSync(tracesPath(), "{not json\n", "utf8");
    expect(readTraces()).toEqual([]);
    expect(() => trace({ type: "x" })).not.toThrow();
    expect(readTraces().map((e) => e.type)).toContain("x");
  });
});
