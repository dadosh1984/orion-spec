# Design — v0-51-cli-shrink-43-to-8

## Архитектура: Registry + 8 Command Handlers

### Целевая файловая структура

```
src/cli/
├── index.ts                  # точка входа (parseArgs → main → dispatcher)
├── parse.ts                  # парсер аргументов (уже есть, расширить алиасами)
├── helpers.ts                # printOut, fail, lineDiff, confirmAction
├── registry.ts               # NEW: Map<string, CommandHandler>
├── commands-list.ts          # DEPRECATE: заменить на registry
├── commands.ts               # SIMPLIFY: только main() + старые алиасы → новые имена
├── commands/                 # NEW: 8 файлов, по одному на top-level команду
│   ├── new.ts                # pipeline driver (think→draft→forge→shield→out)
│   ├── ls.ts                 # list/inspect
│   ├── change.ts             # per-change ops
│   ├── run.ts                # offline scripts (re-export из runCmd.ts)
│   ├── scale.ts              # YAGNI + TDD
│   ├── doctor.ts             # health/init/repair
│   ├── serve.ts              # web UI + mcp
│   └── plugin.ts             # plugin manager
├── overviewCmd.ts            # поглощается в commands/ls.ts
├── planCmd.ts                # поглощается в commands/new.ts (--dry)
├── compareCmd.ts             # поглощается в commands/ls.ts (--diff)
├── selfauditCmd.ts           # поглощается в commands/ls.ts (--audit)
├── backupCmd.ts              # поглощается в commands/doctor.ts
├── changelogCmd.ts           # поглощается в commands/change.ts
├── cleanCmd.ts               # поглощается в commands/doctor.ts
├── completionCmd.ts          # удаляется; completion → static file в dist/
├── configCmd.ts              # поглощается в commands/doctor.ts
├── diffCmd.ts                # поглощается в commands/change.ts
├── doctorCmd.ts              # поглощается в commands/doctor.ts
├── envCmd.ts                 # удаляется; env → debug-режим
├── historyCmd.ts             # удаляется; история → ~/.orion/history.log
├── pluginCmd.ts              # поглощается в commands/plugin.ts
├── routeCmd.ts               # удаляется; debug-функция, не нужна top-level
├── runCmd.ts                 # остаётся как есть (22 sub-commands)
├── scaleCmd.ts               # поглощается в commands/scale.ts
├── serve.ts                  # поглощается в commands/serve.ts
├── shellCmd.ts               # удаляется; REPL не нужен
├── statusWatchCmd.ts         # поглощается в commands/ls.ts (--watch)
├── tddCmd.ts                 # поглощается в commands/scale.ts (--stage=tdd)
├── tokensCmd.ts              # удаляется; metrics в core/metrics.ts (MCP)
└── trackCmd.ts               # удаляется; cache в core/track.ts (MCP)
```

**Итого:** 21 *Cmd.ts → 8 commands/*.ts + 1 runCmd.ts. Файлов в src/cli/ станет меньше.

### Registry (src/cli/registry.ts)

```typescript
import type { CliOptions } from "./helpers.js";

export type CommandHandler = (args: string[], opts: CliOptions) => Promise<number> | number;

export interface CommandSpec {
  name: string;
  description: string;
  handler: CommandHandler;
  /** алиасы (deprecated): `orion list` → `orion ls` */
  aliases?: string[];
  /** sub-commands: `orion serve mcp`, `orion run watch` */
  subcommands?: string[];
}

export const ORION_REGISTRY: Map<string, CommandSpec> = new Map([
  ["new", { name: "new", description: "Pipeline: think→draft→forge→shield→out", handler: newHandler, aliases: ["think", "draft", "forge", "shield", "out", "verify", "plan"] }],
  ["ls", { name: "ls", description: "List/inspect changes", handler: lsHandler, aliases: ["list", "status"] }],
  ["change", { name: "change", description: "Per-change ops: --tasks/--review/--archive/--diff/--changelog", handler: changeHandler }],
  ["run", { name: "run", description: "Offline scripts (22 sub-commands)", handler: runHandler }],
  ["scale", { name: "scale", description: "YAGNI ladder + TDD", handler: scaleHandler, aliases: ["tdd"] }],
  ["doctor", { name: "doctor", description: "Health/init/repair: --init/--config/--clean/--backup/--restore", handler: doctorHandler, aliases: ["init"] }],
  ["serve", { name: "serve", description: "Web UI + `serve mcp`", handler: serveHandler, aliases: ["mcp"] }],
  ["plugin", { name: "plugin", description: "Plugin manager", handler: pluginHandler }],
]);
```

### Алиасы в parse.ts (один маппинг)

```typescript
// DEPRECATED v0.51 — удалить в v0.52
const DEPRECATED_ALIASES: Record<string, string> = {
  think: "new", draft: "new", forge: "new", shield: "new",
  out: "new", verify: "new", plan: "new",
  list: "ls", status: "ls", compare: "ls", assumptions: "ls",
  stats: "ls", "self-audit": "ls",
  tasks: "change", review: "change", archive: "change",
  changelog: "change", diff: "change", resume: "change",
  next: "change", "pay-debt": "change",
  profile: "change", lessons: "change",  // через --export/--import
  track: "ls",  // cache stats → ls --cache
  metrics: "ls", tokens: "ls", learn: "change",  // learn → change --learn
  history: "ls", env: "doctor",  // env → doctor --env
  config: "doctor", clean: "doctor", backup: "doctor", restore: "doctor",
  mcp: "serve",  // `orion mcp` → `orion serve mcp`
  tdd: "scale",
  init: "doctor",  // `orion init` → `orion doctor --init`
  shell: "ls",  // REPL удалён; `orion shell` → `orion ls` (с warning)
  completion: "shell",  // удалено; static file
  route: "__hidden__",  // не в registry, ошибка
  help: "__help__",  // встроенный
  version: "__version__",  // встроенный
};
```

### Главный dispatcher (src/cli/commands.ts)

```typescript
export async function main(args: string[]): Promise<number> {
  const [raw, ...rest] = args;
  const canonical = DEPRECATED_ALIASES[raw] ?? raw;
  
  if (canonical === "__help__") return printHelp();
  if (canonical === "__version__") return printVersion();
  if (canonical === "__hidden__") return fail(`Unknown command: ${raw}`);
  
  const spec = ORION_REGISTRY.get(canonical);
  if (!spec) return printHelp();
  
  if (raw !== canonical) {
    console.warn(`⚠️  '${raw}' is deprecated, use '${canonical}' instead (will be removed in v0.52)`);
  }
  
  return spec.handler(rest, parseFlags(rest));
}
```

### Тесты

- `tests/cli-registry.test.ts` — 8 команд в registry, все резолвятся
- `tests/cli-aliases.test.ts` — 35 алиасов работают, выдают warning
- `tests/cli-help.test.ts` — `orion --help` ≤ 24 строки
- `tests/cli-smoke.test.ts` — smoke для каждой из 8 команд (по 1 тесту)
- Существующие тесты: должны проходить без изменений (мы не трогаем поведение)

### Что НЕ меняется

- `src/core/*` — без изменений
- `src/skills/*` — без изменений (хендлеры просто переезжают в commands/new.ts)
- `src/utils/*` — без изменений
- `tests/*` — добавляются новые, существующие не трогаем
- `package.json`, `tsconfig.json`, `eslint.config.js` — без изменений
