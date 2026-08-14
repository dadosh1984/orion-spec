/**
 * Task surface for the D2 distribution change — `# Spec: packageSurface`.
 *
 * Small real helper: asserts the publishable package surface stays clean of
 * a self-dependency (`orion-spec: link:`), which would break `npm install`.
 * Pure/sync/zero-dep. Used by the distribution tests to catch the exact
 * regression that blocked 0.52.0.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Clean-package check — no self-dependency, real bin target, engines.node. */
export function packageSurface(): {
  ok: boolean;
  selfDep: boolean;
  bin: string | null;
  node: string | null;
} {
  // yagni: 1 root package.json, no dep — read via require to stay PURE.
  const pkg = require("../../package.json") as {
    dependencies?: Record<string, string>;
    bin?: Record<string, string>;
    engines?: { node?: string };
  };
  const deps = pkg.dependencies ?? {};
  const selfDep = Object.values(deps).some((v) => v === "link:");
  const bin = pkg.bin?.orion ?? null;
  const node = pkg.engines?.node ?? null;
  return { ok: !selfDep && bin !== null && node !== null, selfDep, bin, node };
}
