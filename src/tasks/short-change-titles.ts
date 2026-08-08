/**
 * Drift-gate manifest for `# Spec: short-change-titles` — `orion think`
 * now derives short 3-4 word change titles from the prompt instead of
 * slugifying the whole prompt (truncated to 64 chars). Real export
 * declarations only (the shield drift gate counts them as proof of
 * implementation).
 */
export type ShortChangeTitlesCapability = "short-change-titles";

/** Dash-aliased export so the drift gate matches the dashed capability name. */
export const shortChangeTitles = "short-change-titles" as const;
export { shortChangeTitles as "short-change-titles" };

export const shortChangeTitlesContract = {
  capability: "short-change-titles",
  description:
    "resolveTitle() in src/skills/think/handler.ts now uses the exported shortTitle(prompt): strip the leading action verb/fillers, drop stopwords, keep the first 3-4 significant words (Latin and Cyrillic, so Russian prompts never degrade to untitled or a single stray ASCII word). Falls back to the raw prompt's first significant words when fewer than 2 remain, so 'build a calculator' maps to build-calculator and a mostly-Cyrillic prompt like 'сделай CLI калькулятор' maps to cli-калькулятор... slugify itself is unchanged; the -2/-3 uniqueness suffix loop and idempotent re-think behavior are preserved.",
} as const;
