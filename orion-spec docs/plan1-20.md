# Orion Implementation Plan – Steps 1‑20

**0️⃣ Подготовка окружения**
1. Открыть PowerShell и перейти в `E:\SYSTEM\Desktop\AI_Projects\orion-dev`.
2. Инициализировать git‑репозиторий (`git init`).
3. Создать `.gitignore` (node_modules, dist, .orion, .env).
4. Установить Node ≥ 22.12 и `pnpm` (npm i -g pnpm).
5. Инициализировать npm‑пакет (`pnpm init -y`).
6. Добавить поле `"type":"module"` в `package.json`.
7. Установить dev‑зависимости: `typescript@5`, `eslint@9`, `prettier@3`, `vitest@1`, `@types/node`.
8. Сгенерировать `tsconfig.json` (rootDir src, outDir dist, esModuleInterop).
9. Сгенерировать ESLint‑конфиг (`pnpm exec eslint --init`) – выбрать TypeScript, Node, Prettier, recommended.
10. Добавить скрипты в `package.json` (build, lint, format, test, watch, prepare).
11. Создать директорию `src/` и подпапки `cli, core, skills, utils, config`.
12. В `src/` создать `type.ts` с базовыми типами (`SkillName`, `CacheKey`, `TaskStatus`).
13. Добавить `README.md`‑шаблон (краткое описание, CI‑badge, ссылка на docs).
14. Добавить `LICENSE` (MIT).
15. Создать `.npmrc` (`engine-strict=true`).
16. Создать `src/cli/index.ts` (точка входа, #!/usr/bin/env node).
17. Создать `src/cli/commands.ts` (парсер команд, справка, dispatch).
18. Добавить `src/utils/hash.ts` (SHA‑256 функция).
19. Добавить `src/utils/file.ts` (readFile, writeFile, ensureDir).
20. Добавить скелетные файлы `src/core/track.ts`, `src/core/scale.ts`, `src/core/tddCore.ts` и подпапки `src/skills/think, draft, forge, shield` с `handler.ts`.
