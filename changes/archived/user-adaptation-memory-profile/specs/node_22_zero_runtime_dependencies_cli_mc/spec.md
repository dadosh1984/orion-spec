# Spec: node

## Purpose
A user-adaptation profile (`~/.orion/profile.md`, the memory.md analogue)
plus visible self-correction in the terminal.

## Scope

- In scope: an auto-maintained, hand-editable profile recording the user's
  prompt language, typical platform/budget and frequent topic words;
  a `orion profile` CLI command and an MCP `profile` tool; a stderr marker
  (🧠) whenever Orion records a lesson or attaches past lessons, toggleable
  via `ORION_LESSON_NOTIFY=0`.
- Out of scope: adapting artifact tone beyond language recording; anything
  not stated in the proposal.

## Acceptance criteria
- [ ] `think` updates the profile on every proposal and preserves the
      `## User notes` section verbatim (ORION_PROFILE_FILE override for tests)
- [ ] `orion profile` shows the profile or an honest "no profile yet" hint
- [ ] MCP `profile` tool returns the same view
- [ ] Recording a lesson prints `🧠 orion lesson recorded — …` to stderr;
      attaching past lessons prints `🧠 orion applies N past lesson(s)`
- [ ] `ORION_LESSON_NOTIFY=0` silences the markers
- [ ] existing test suite, lint and type-check stay green
