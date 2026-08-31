import { performance } from "node:perf_hooks";

export interface BenchmarkScenario {
  id: string;
  name: string;
  run: () => Promise<void> | void;
}

export interface ScenarioResult {
  id: string;
  wallClockMs: number;
  memoryDeltaMb: number;
}

/**
 * Standard benchmark suite measuring wall-clock time and memory delta.
 */
export async function runStandardSuite(
  scenarios: BenchmarkScenario[],
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];

  for (const s of scenarios) {
    if (globalThis.gc) globalThis.gc();
    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    await s.run();

    const duration = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;

    results.push({
      id: s.id,
      wallClockMs: Math.round(duration * 100) / 100,
      memoryDeltaMb:
        Math.round(((memAfter - memBefore) / (1024 * 1024)) * 100) / 100,
    });
  }

  return results;
}
