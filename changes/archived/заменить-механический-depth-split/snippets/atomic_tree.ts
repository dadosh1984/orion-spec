/**
 * GREEN — honest atomic decomposition (v0.51) replacing mechanical depth-split.
 * src/skills/draft/atomic.ts:
 *   - isAtomicStep: verbs<2 AND no coordination/alternative splitter
 *   - countActions: skips verb-like nouns after determiners ("add a test")
 *   - splitStep: cut at coordinating conjunctions / comma
 *   - atomicTree: recurse to atomic leaves; maxDepth ceiling (default 4)
 *     downgrades residual ambiguity to [ask-user] clarifying question
 * renderTasksBody uses atomicTree for depth>=2; RED→fix→verify maintenance
 * plans (detected via (RED)/(GREEN) markers) bypass re-split.
 */
