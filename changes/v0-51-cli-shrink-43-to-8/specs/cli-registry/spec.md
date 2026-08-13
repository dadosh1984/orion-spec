# Spec: cli-registry

## API

```typescript
// src/cli/registry.ts
export interface CommandSpec {
  name: string;
  description: string;
  handler: (args: string[], opts: CliOptions) => Promise<number> | number;
  aliases?: string[];
  subcommands?: string[];
}

export const ORION_REGISTRY: ReadonlyMap<string, CommandSpec>;
```

## Invariants

- `ORION_REGISTRY.size === 8` (после T2; до этого — пустой).
- Каждый `name` уникален.
- Каждый `alias` уникален в рамках всех spec'ов.
- `handler` — async или sync функция, возвращает `Promise<number> | number`, где 0 = success.

## Failure modes

- Если `args[0]` не найден ни в `ORION_REGISTRY`, ни в `DEPRECATED_ALIASES` → `printHelp()` + return 1.
- Если handler бросает exception → main() ловит, печатает stacktrace, return 1.
- Если alias разрешается в себя (например, `help` → `help`) → обрабатывается в `parse.ts`, не в registry.
