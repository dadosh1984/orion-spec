import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
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
