import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  estimateTokens,
  runBenchmark,
  tokenBudget,
  asciiBar,
  metricsReport,
} from "../src/core/metrics.js";
import { main } from "../src/cli/commands.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-metrics-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("metrics: token budget", () => {
  it("estimateTokens uses the 4-bytes-per-token heuristic", () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(100)).toBe(25);
  });

  it("tokenBudget groups cache keys by namespace, largest first", () => {
    const track = OrionTrack.init();
    track.store("scale:yagni:aaa", "x".repeat(100));
    track.store("scale:stdlib:bbb", "x".repeat(40));
    track.store("forge:demo", "DONE");
    track.store("plain", "1");
    const budget = tokenBudget(track);
    expect(budget[0].namespace).toBe("scale");
    expect(budget.map((b) => b.namespace)).toEqual(
      expect.arrayContaining(["scale", "forge", "plain"]),
    );
    const scale = budget.find((b) => b.namespace === "scale");
    expect(scale?.bytes).toBeGreaterThanOrEqual(140);
    expect(scale?.tokens).toBe(estimateTokens(scale!.bytes));
    expect(scale?.share).toBeGreaterThan(0);
    // shares sum to ~1
    const total = budget.reduce((sum, b) => sum + b.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("tokenBudget is empty for an empty cache", () => {
    expect(tokenBudget(OrionTrack.init())).toEqual([]);
  });

  it("asciiBar renders proportional bars", () => {
    expect(asciiBar(0, 0)).toBe("░".repeat(20));
    expect(asciiBar(50, 100)).toContain("█");
    expect(asciiBar(100, 100)).toBe("█".repeat(20));
    const half = asciiBar(50, 100, 10);
    expect(half).toBe("█████░░░░░");
  });
});

describe("metrics: benchmark", () => {
  it("runBenchmark reports cold and hot passes with stages", async () => {
    const track = OrionTrack.init();
    const { timings, stages } = await runBenchmark(track);
    expect(timings).toHaveLength(2);
    expect(timings.map((t) => t.pass)).toEqual(["cold", "hot"]);
    expect(timings.every((t) => t.durationMs > 0)).toBe(true);
    expect(stages.length).toBeGreaterThanOrEqual(7);
    expect(stages.every((s) => s.durationMs > 0)).toBe(true);
    expect(stages.find((s) => s.stage === "yagni")?.changed).toBe(false);
  });

  it("metricsReport composes timings, budget and cache stats", async () => {
    const track = OrionTrack.init();
    track.store("forge:demo", "DONE");
    const report = await metricsReport(track, "5.0.0");
    expect(report.version).toBe("5.0.0");
    expect(report.timings).toHaveLength(2);
    expect(report.cached.count).toBeGreaterThanOrEqual(1);
    expect(report.totalTokens).toBeGreaterThanOrEqual(0);
  });
});

describe("metrics: CLI", () => {
  it("orion metrics prints a report and returns 0", async () => {
    expect(await main(["metrics"])).toBe(0);
  });

  it("orion metrics --json returns structured data", async () => {
    const out = await main(["metrics", "--json"]);
    expect(out).toBe(0);
  });
});
