/**
 * GREEN — BM25 skill matching + miss-log + gated promotion (Phase 1/2).
 * src/core/skillsMatch.ts:   matchSkill — BM25 over name+tags+description,
 *   domain filtered BEFORE scoring, conservative thresholds (USE_SKILL /
 *   CANDIDATES / NO_MATCH) respecting error asymmetry (false positive costs
 *   more than false reject).
 * src/core/skillMissLog.ts:  logSkillMiss / promotionCandidates — logs every
 *   non-confident match from day 1 (required to tune thresholds + find
 *   promotion candidates); repeated signatures => candidates, gated by review.
 * src/core/runtime.ts:       RunManifest extended with tags/domain/env-fingerprint.
 * src/cli/runCmd.ts:         `orion run match "<step>"` + `orion run match --promote`.
 */
