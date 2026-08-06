/**
 * Drift-gate manifest for `# Spec: compress` (v0.14) — the token-economy
 * compressor with high-value collapse rules. Real export declarations only
 * (the shield drift gate counts them as proof of implementation).
 */
export type CompressCapability =
  | "token-economy"
  | "docker"
  | "pytest"
  | "cargo"
  | "terraform"
  | "npm-list"
  | "pip-freeze"
  | "ps";

export const compress: CompressCapability = "token-economy";

export const compressContract = {
  capability: "compress",
  description:
    "compress command output before agents read it (docker, pytest, cargo, terraform, npm list, pip freeze, ps) with honest ≈ bytes/4 savings",
} as const;
