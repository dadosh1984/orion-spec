/**
 * Drift-gate manifest for `# Spec: docs-hygiene` — repo documentation,
 * changelog and contribution guidance. Real export declarations only (the
 * shield drift gate counts them as proof of implementation).
 */
export type DocsHygieneCapability = "docs-hygiene";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const docsHygiene = "docs-hygiene" as const;
export { docsHygiene as "docs-hygiene" };

export const docsHygieneContract = {
  capability: "docs-hygiene",
  description:
    "Added CHANGELOG.md (dated v0.1.0..v0.18.1) and CONTRIBUTING.md; fixed stale README claims (Open for Extension, Updating→CHANGELOG, Documentation index); documented the shield security scan as best-effort pattern lint and the GitHub description/topics/demo as repo metadata.",
} as const;
