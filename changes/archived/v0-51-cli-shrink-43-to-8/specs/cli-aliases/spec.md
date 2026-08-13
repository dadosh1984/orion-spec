# Spec: cli-aliases

## API

```typescript
// src/cli/parse.ts
export const DEPRECATED_ALIASES: Readonly<Record<string, string>>;
```

## Mapping (35 алиасов → 8 команд)

| Алиас (deprecated) | → | Команда (v0.51) | Группа |
|---|---|---|---|
| `think` | → | `new` | pipeline |
| `draft` | → | `new` | pipeline |
| `forge` | → | `new` | pipeline |
| `shield` | → | `new` | pipeline |
| `out` | → | `new` | pipeline |
| `verify` | → | `new` | pipeline |
| `plan` | → | `new --dry` | pipeline |
| `list` | → | `ls` | list |
| `status` | → | `ls` | list |
| `compare` | → | `ls --diff` | list |
| `assumptions` | → | `change <id> --assumptions` | list |
| `stats` | → | `ls --stats` | list |
| `self-audit` | → | `ls --audit` | list |
| `tasks` | → | `change <id> --tasks` | change |
| `review` | → | `change <id> --review` | change |
| `archive` | → | `change <id> --archive` | change |
| `changelog` | → | `change <id> --changelog` | change |
| `diff` | → | `change <id> --diff` | change |
| `resume` | → | `change <id> --resume` | change |
| `next` | → | `change <id> --next` | change |
| `pay-debt` | → | `change <id> --pay-debt` | change |
| `profile` | → | `change <id> --profile` | change |
| `lessons` | → | `change <id> --lessons` | change |
| `track` | → | `ls --cache` | list |
| `metrics` | → | `ls --metrics` | list |
| `tokens` | → | `ls --tokens` | list |
| `learn` | → | `change <id> --learn` | change |
| `history` | → | `ls --history` | list |
| `env` | → | `doctor --env` | doctor |
| `config` | → | `doctor --config` | doctor |
| `clean` | → | `doctor --clean` | doctor |
| `backup` | → | `doctor --backup` | doctor |
| `restore` | → | `doctor --restore` | doctor |
| `mcp` | → | `serve mcp` | serve |
| `tdd` | → | `scale --stage=tdd` | scale |
| `init` | → | `doctor --init` | doctor |
| `shell` | → | (error: removed) | meta |
| `completion` | → | (static file) | meta |
| `route` | → | (hidden, debug) | debug |
| `help` | → | `--help` flag | meta |
| `version` | → | `--version` flag | meta |

## Invariants

- Каждый алиас в `DEPRECATED_ALIASES` имеет свой target.
- `ORION_REGISTRY` не содержит ни одного ключа из `DEPRECATED_ALIASES` (они резолвятся отдельно).
- При вызове deprecated команды → `console.warn("⚠️  '<old>' is deprecated, use '<new>' instead (removed in v0.52)")` в stderr.

## Failure modes

- Если алиас резолвится в другой алиас (chain) → `parse.ts` делает single-step resolve (без рекурсии), иначе ошибка.
- Если алиас и новое имя совпадают (`new` → `new`) → нет warning, проходит прозрачно.
