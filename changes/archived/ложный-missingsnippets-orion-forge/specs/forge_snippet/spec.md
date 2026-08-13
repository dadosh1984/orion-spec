# Spec: forge_snippet

## Purpose

`orion forge` waits for `changes/<title>/snippets/<slug>.ts`, where the slug
is derived deterministically from the current task text (shortSlug, v0.24).
Files that exist under any other name — legacy long slugs from before v0.24
(e.g. `fact_v77_reader_1cv77_dat_id_nnn_yyyymmdd.ts`), or agent-guessed
names — previously produced a false `missingSnippets` even though the
content existed. This capability adds snippet resolution with an honest
fallback: exact match first, then a UNIQUE legacy/prefix match, otherwise a
miss that reports the existing files.

## Acceptance criteria

- [ ] Exact file `snippets/<slug>.ts` always wins (mode "exact")
- [ ] A unique legacy/prefix candidate is accepted (mode "legacy"): slug
      tokens found in the marker-stripped basename, or basename starting
      with the slug; ambiguity (tie) is a miss, never a silent guess
- [ ] A genuine miss returns `{content: null, candidates}` — existing
      snippet files, near-misses first — so the agent can rename
- [ ] `orion forge` (sequential and `--parallel` worker) routes snippet
      lookups through the resolver; the paused message lists existing
      files when a snippet cannot be resolved
- [ ] Deterministic, zero-dependency, sorted reads, never throws
