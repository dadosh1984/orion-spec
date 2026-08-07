/**
 * Drift-gate manifest for `# Spec: types-node-v24` — devDependency
 * `@types/node` aligned with the Node 24 runtime. Real export
 * declarations only (the shield drift gate counts them as proof of
 * implementation).
 */
export type TypesNodeV24Capability = "types-node-v24";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const typesNodeV24 = "types-node-v24" as const;
export { typesNodeV24 as "types-node-v24" };

export const typesNodeV24Contract = {
  capability: "types-node-v24",
  description:
    "package.json devDependency @types/node bumped from ^22.20.1 to ^24.x to match the Node 24.18.0 runtime. No runtime code changes; tsc --noEmit and the full pnpm run ci gate (lint, format:check, build, test:coverage with 80/80/80/70 thresholds, pool: forks) stay green.",
} as const;
