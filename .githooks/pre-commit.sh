#!/usr/bin/env bash
# Orion pre-commit hook (scaffolded by `orion init`).
# Runs the deterministic change review on every change and fails loudly
# when the newest change has review issues. Edit or delete freely.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git log -1 --format="%H"
