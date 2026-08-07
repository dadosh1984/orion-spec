# Spec: orion-spec-cli-new-verify-command

## Purpose
Add a first-class `orion verify <change>` command implementing a whole-change
spec-to-source evidence pass (idea from a sibling spec-driven toolkit,
reimplemented in orion's own style — nothing copied). For each
acceptance-criterion bullet in a change's specs, extract its distinctive terms
and scan the project source for evidence; classify each criterion
compliant / missing / drifted, and report criteria that have no code evidence
even when the change's checks pass individually. It is a deterministic,
honest signal (surfaced as a list + summary), never a gate.

## Acceptance criteria
- The CLI exposes `orion verify <change-id>` (parse, dispatch, HELP entry) and prints a per-criterion report plus a missing/drifted summary; `--json` emits the structured result.
- The evidence pass extracts acceptance-criterion bullets from each spec file under `changes/<id>/specs/` (task-list checkbox markers stripped, bullets outside criteria headings ignored).
- Each criterion is classified compliant (all distinctive terms found in source), drifted (some but not all), or missing (none), using conservative tokenization (≥4 chars, stopwords excluded, de-duplicated).
- Criteria with too few distinctive terms are reported compliant, never missing, so weak prose can never produce a false alarm.
- Missing criteria are surfaced first-class with a `⚠️ … no code evidence` warning; the command still exits 0 (a signal, never a gate).
- The command throws honestly when the change does not exist.
