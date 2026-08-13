/**
 * GREEN — pure matching core + shadow migration + async resolver.
 * src/core/skillsMatch.ts:
 *   - matchSkill(step, opts): PURE/SYNC/DETERMINISTIC. Returns
 *     matched | none | ambiguous. Scores normalized to [0,1] (score/max in
 *     the candidate set) so the 0.45 threshold is corpus-independent.
 *     Never invokes the LLM. tier = exact | bm25.
 *   - resolveAmbiguous(step, candidates): SEPARATE async; called by both
 *     run/forge and the CLI — one orchestration path, no branch divergence.
 *   - shadowCompare(cases): runs BM25 and the forked naive scorer on the
 *     SAME cases so naive is deleted with data, not blindly. naiveScore()
 *     kept only for this comparison.
 *   - environmentFingerprint(): Phase-4 hook (write now, invalidate later).
 * src/cli/runCmd.ts: orion run match "<step>" (tier/score, log miss),
 *   --shadow (BM25 vs naive), --promote (candidates), ambiguous→resolver.
 *
 * v0.51 fixes from code review:
 * - resolveDomain(): explicit .orion/config.json → ORION_DOMAIN env → general
 *   (maps project→domain without guessing from repo name; hardcoded "general"
 *   in runCmd removed).
 * - resolveAmbiguous(): multi-candidate short-list returns {kind:"none"} —
 *   never picks the top for you (error asymmetry); resolution happens a layer
 *   up (Claude Code / the caller), keeping zero runtime deps.
 *
 * Three pre-first-skill fixes (v0.51):
 * - tier tautology removed: exact <=> all skill-name tokens in the query;
 *   bm25 tier is now honest (was always "exact").
 * - unified matching: router.routeRequest and commands (think/draft hints)
 *   now use matchSkill; dead findExistingSkill deleted (was a second scorer
 *   with a different threshold — two paths would disagree).
 * - createScript/generator/--save-as fill domain (resolveDomain) +
 *   environmentFingerprint at creation time.
 */
