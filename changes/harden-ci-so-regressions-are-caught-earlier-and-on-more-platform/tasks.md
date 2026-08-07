# Tasks — harden-ci-so-regressions-are-caught-earlier-and-on-more-platform

- [x] [fact] Add a GitHub Actions OS matrix (ubuntu-latest, windows-latest, macos-latest) to the CI workflow
- [x] [fact] Add a per-file coverage gate script for the core pipeline modules (track.ts >= 90, scale.ts >= 95, tddCore.ts >= 85) reading coverage/coverage-summary.json
- [x] [fact] Wire the core gate into package.json (`core:coverage`) and add it as a CI step after coverage on every OS
- [x] [fact] Keep the global coverage threshold at 80
- [x] [fact] Verify the gate passes on the current baseline (green) and fails honestly when coverage drops
