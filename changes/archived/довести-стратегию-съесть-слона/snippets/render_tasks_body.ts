/**
 * GREEN — renderTasksBody(derived, depth, title) in src/skills/draft/handler.ts.
 * depth>=2 emits a «eat an elephant» tree (## big steps → ### medium groups)
 * while keeping every task an unindented `- [ ]` checkbox so forge's
 * readTasks regex still parses it. depth<2 → flat checklist (compat).
 *
 * Router abstract gate: classifyComplexity(...).complexity === "abstract",
 * with classifyTask categories, routes questions to DIRECT_AI — never forge.
 */
