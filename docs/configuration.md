# Orion configuration

Orion ships zero dependencies and no config file by default — everything is
tunable with environment variables (below) or scratch files it already
writes. The only thing you normally opt into is `orion init`.

## Environment variables

All `ORION_*` paths are directories/files Orion picks up at runtime. If one
is unset, Orion uses a sensible default under the user home dir
(`~/.orion`). Set them per-shell, or export them in your project's `.env`
load by your agent.

| Variable | Purpose | Default |
|----------|---------|---------|
| `ORION_CACHE_DIR` | Cache directory (token economy / proposals / forge results) | `~/.orion/cache` |
| `ORION_STATE_DIR` | General state directory | `~/.orion` |
| `ORION_LESSONS_FILE` | Self-correction lesson ledger (JSONL) | `~/.orion/lessons.json` |
| `ORION_PROFILE_FILE` | User-adaptation profile (`memory.md` analogue) | `~/.orion/profile.md` |
| `ORION_TEMPLATES_DIR` | User-level template overrides (one file per artifact) | `~/.orion/templates` |
| `ORION_DEBT_FILE` | YAGNI debt ledger | `~/.orion/debt.json` |
| `ORION_SPEND_FILE` | Token-budget spend ledger | `~/.orion/spend.json` |
| `ORION_ECONOMY_FILE` | Append-only token-economy log | `~/.orion/economy.json` |
| `ORION_CALIBRATION_FILE` | Token/budget calibration data | `~/.orion/calibration.json` |
| `ORION_TRACES_FILE` | Activity traces (telemetry) | `~/.orion/traces.json` |
| `ORION_TDD_CACHE_DIR` | TDD engine cache | `~/.orion/tdd` |
| `ORION_PLUGIN_DIR` | Installed plugins directory | `~/.orion/plugins` |
| `ORION_LESSON_NOTIFY` | `0` disables the visible self-correction notification (stderr) | `1` (on) |
| `ORION_SHIELD_SKIP_SHELL` | `1` skips the live shell gate in shield (used for slow/CI runs) | unset |
| `ORION_FORGE_TASK_TIMEOUT_MS` | Per-task timeout for the forge wave engine | project default |
| `ORION_MCP_VERBOSE` | `1` logs MCP protocol traffic to stderr | unset |
| `ORION_MAX_BUDGET_TOKENS` | Hard ceiling for budget accounting | unlimited |
| `ORION_TOKEN_PRICES` | JSON token-price overrides | built-in prices |
| `ORION_TELEMETRY` | Enable/disable traces | unset |
| `ORION_DASHBOARD_TOKEN` | Auth token for `orion serve` | auto (non-loopback) |
| `ORION_UPDATE_CHECK` | `0` disables the non-blocking update banner on `orion mcp` | `1` (on) |

## `orion init`

`orion init` scaffolds local config idempotently (never overwrites):

- `src/config/orionTdd.json` — TDD engine config
- `.orion/deny.txt` — guard-prompt deny-list policy template
- `.githooks/pre-commit.sh` — optional pre-commit hook starter

## Template overrides

draft artifacts (proposal/design/tasks/spec) are rendered from templates.
Override any of them per change (`changes/<id>/templates/<name>.md`) or
user-wide (`~/.orion/templates/<name>.md`) — custom output carries an
honest `<!-- orion: template=<path> (custom) -->` marker.

## Language

Artifact templates are language-aware (v0.27): the profile's detected
language selects English or Russian skeletons. Override per run with
`draft --lang en|ru`.
