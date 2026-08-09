/**
 * Drift-gate manifest for `# Spec: forge_snippet` (v0.25) — snippet
 * resolution fallback for orion forge. Real implementation lives in
 * src/skills/forge/snippet.ts (resolveSnippet); handler.ts and worker.ts
 * route their snippet lookups through it, so a legacy/prefix-named file
 * no longer produces a false missingSnippets.
 */
export const forge_snippet = "snippet-resolution-fallback";
