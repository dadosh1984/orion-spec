/**
 * Drift-gate manifests for v0.18 specs: `calibration` (H), `debt` (I),
 * `budget-zone` (J), `cli-activity` (L). Dash-carrying capability names are
 * exported through real string-named aliases (`export { x as "cap-name" }`
 * — valid ES exports, matched by the drift gate since v0.15).
 */
export const calibration = "calibrated-estimates";

export const debt = "deferred-debt-registry";

export const budgetZone = "budget-warn-in-next";

export { budgetZone as "budget-zone" };

export const cliActivity = "cli-activity-indicator";

export { cliActivity as "cli-activity" };

export const v018Contract = {
  capabilities: ["calibration", "debt", "budget-zone", "cli-activity"],
  description:
    "v0.18: next estimates calibrate against measured reality (median actual/estimate), shield yagni WARNs feed an automatic debt registry, next warns when a candidate exceeds its proposal budget, and direct CLI runs announce themselves on stderr",
} as const;
