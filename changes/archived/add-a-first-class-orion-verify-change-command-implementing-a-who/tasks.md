# Tasks — add-a-first-class-orion-verify-change-command-implementing-a-who

- [x] [fact] Add `src/core/verify.ts`: whole-change spec→source evidence pass — extract acceptance-criterion bullets from a change's specs, tokenize each (distinctive terms), scan the project source, classify compliant / missing / drifted
- [x] [fact] Wire `orion verify <change>` as a first-class CLI command (parse + dispatch + HELP) that prints per-criterion findings and a summary
- [x] [fact] Keep it a signal, never a gate (exit 0 unless the change does not exist); unchanged shield/out/drift behavior
- [x] [fact] Cover the evidence pass with tests (compliant, missing, drifted, empty specs, tokenization conservatism)
- [x] [fact] DRIFT manifest + keep all existing tests green
