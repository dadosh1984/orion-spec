/**
 * Task surface for the atomic-step matcher (v0.51/0.52).
 *
 * Pure re-export of the real implementation in `src/core/skillsMatch.ts`
 * so the capability is reachable from the `# Spec: matchSkill` drift check
 * regardless of how the shield scans exports. No logic lives here.
 */
export {
  matchSkill,
  resolveDomain,
  listSkills,
  naiveScore,
  shadowCompare,
  environmentFingerprint,
} from "../core/skillsMatch.js";
export type {
  SkillMeta,
  MatchTier,
  MatchDecision,
  MatchInput,
  MatchOptions,
} from "../core/skillsMatch.js";
