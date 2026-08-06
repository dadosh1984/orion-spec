import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v0.4 sandboxed CI — static checks for the Docker assets.
 * Real validation happens in CI (`docker build` step); these tests guard the
 * critical directives so regressions surface in any local test run too.
 */
describe("Docker image (v0.4)", () => {
  const root = process.cwd();

  it("Dockerfile exists with a multi-stage build and orion entrypoint", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("FROM node:22-alpine AS builder");
    expect(dockerfile).toContain("FROM node:22-alpine AS runtime");
    expect(dockerfile).toContain('ENTRYPOINT ["node", "dist/cli/index.js"]');
    expect(dockerfile).toContain("pnpm install --frozen-lockfile");
    expect(dockerfile).toContain("COPY --from=builder");
  });

  it("Dockerfile pins the pnpm version from package.json", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as {
      packageManager?: string;
    };
    const pnpmVersion = pkg.packageManager?.replace("pnpm@", "");
    expect(pnpmVersion).toBeDefined();
    expect(dockerfile).toContain(`pnpm@${pnpmVersion}`);
  });

  it(".dockerignore excludes build artifacts and dev folders", () => {
    const ignore = readFileSync(join(root, ".dockerignore"), "utf8");
    for (const entry of ["node_modules", "dist", ".git", "changes", "tests"]) {
      expect(ignore).toContain(entry);
    }
  });

  it("docker-compose.yml mounts the project and disables networking", () => {
    const compose = readFileSync(join(root, "docker-compose.yml"), "utf8");
    expect(compose).toContain("network_mode: none");
    expect(compose).toContain("orion-cache:/root/.orion");
    expect(compose).toContain("dockerfile: Dockerfile");
  });
});
