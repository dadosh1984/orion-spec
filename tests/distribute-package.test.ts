import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function pkgJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
}

function lockYaml(): string {
  return readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8");
}

describe("distribute orion-spec (D2) — clean package surface", () => {
  it("package.json has no self-dependency 'orion-spec: link:'", () => {
    const p = pkgJson();
    const deps = (p.dependencies ?? {}) as Record<string, string>;
    expect(p.dependencies).toBeUndefined();
    // the value, if ever reintroduced, must never be a pnpm link:
    expect(Object.values(deps)).not.toContain("link:");
  });

  it("package.json does not pin orion-spec as its own dependency", () => {
    const p = pkgJson();
    const all = {
      ...((p.dependencies ?? {}) as Record<string, unknown>),
      ...((p.devDependencies ?? {}) as Record<string, unknown>),
    };
    expect(all["orion-spec"]).toBeUndefined();
  });

  it("bin entry point exists after build (dist/cli/index.js)", () => {
    const p = pkgJson();
    const bin = (p.bin ?? {}) as Record<string, string>;
    expect(bin.orion).toBe("dist/cli/index.js");
    expect(existsSync(join(ROOT, "dist", "cli", "index.js"))).toBe(true);
  });

  it("release.yml guards publish behind --provenance and idempotent no-op; prepublishOnly built in package.json", () => {
    const wf = readFileSync(
      join(ROOT, ".github", "workflows", "release.yml"),
      "utf8",
    );
    expect(wf).toContain("--provenance");
    expect(wf).toMatch(/npm view "orion-spec@\$\{PKG_VERSION\}"/); // idempotent no-op
    const scripts = pkgJson().scripts as Record<string, string>;
    expect(scripts.prepublishOnly).toBe("pnpm run build");
  });

  it("pnpm-lock has no importer self-dependency (only the harmless self-override pnpm adds for a root-named package)", () => {
    const yaml = lockYaml();
    // pnpm v9 always adds `overrides: <root-name>: 'link:'` when the package
    // name matches the root — that never reaches the published tarball.
    // What must NOT exist is an `importers: .: dependencies:` block pinning
    // the package to itself (that is what a stale lock carried).
    expect(yaml).toMatch(/importers:\n\n  \.:\n    devDependencies:/);
    // no importer-level self dependency under `.`
    expect(yaml).toMatch(/  \.:\n    devDependencies:/);
  });

  it("engines.node matches the action runner (>=22.12)", () => {
    const p = pkgJson();
    expect((p.engines as Record<string, string>).node).toBe(">=22.12.0");
  });
});
