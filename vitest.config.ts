import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    // Allow CI/CI runners with few cores to bound fork workers (v0.30):
    // defaults to one less than the CPU count, like vitest, but can be
    // pinned to reduce memory pressure on loaded runners.
    ...(process.env.ORION_VITEST_MAX_WORKERS
      ? {
          maxWorkers: Number(process.env.ORION_VITEST_MAX_WORKERS),
          minWorkers: 1,
        }
      : {}),
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Nested vitest runs (forge/tdd spawn `pnpm vitest run` as a child of
    // the outer run) must NOT share the outer run's transform cache
    // (node_modules/.vite) — concurrent read/write of the same cache
    // corrupts entries and fails runs randomly on loaded CI runners
    // (v0.24). tddCore sets ORION_TDD_CACHE_DIR on the child env; when
    // unset (plain `orion tdd`, or a dev running vitest directly) the
    // default is unchanged.
    cache: {
      dir: process.env.ORION_TDD_CACHE_DIR ?? "./node_modules/.vite",
    },
  },
  coverage: {
    provider: "v8",
    reporter: ["text", "json-summary"],
    include: ["src/**/*.ts"],
    exclude: [
      "src/cli/index.ts",
      // fork-entry point (v0.16): executes as its own child process in
      // `forge --parallel`, exercised by the e2e suite; v8 coverage of
      // the parent process cannot observe a forked worker
      "src/skills/forge/worker.ts",
    ],
    thresholds: {
      lines: 80,
      functions: 80,
      statements: 80,
      branches: 70,
    },
  },
});
