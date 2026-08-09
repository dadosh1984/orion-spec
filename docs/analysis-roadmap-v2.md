# Orion — глубокий аудит и каталог улучшений (v2)

Объект аудита: `orion-spec` **v0.29.0**, 96 src (~12 400 строк), 56 тестов (~9 200 строк), 566 тестов, lint+tsc чистые.
Метод: факты аудита (grep, дубли, прогоны) + систематизированные категории. Ничего не выдумано; где компонент совершенен — отмечено честно.

## A. Реальные находки аудита

1. **A1 — Дубль `readCapped`**: идентична в `core/verifiability.ts` (64КБ) и `core/verify.ts` (128КБ). → общий util + параметр.
2. **A2 — Guard-фолз-позитив на годы**: `think` блокирует датированные имена (`analysis-2026-roadmap`) как «галлюцинированный пакет». Разрешить для локальных путей.
3. **A3 — `bar` (ascii-гистограмма)**: две похожие реализации в `shield/policy.ts` и `serve.ts` → одна.
4. **A4 — `collectTsFiles`**: общая тема в `scaleStages/reuse.ts` и `shield/policy.ts` → общий walker.
5. **A5 — Мёртвого кода нет** (194 функции, все использованы; TODO/FIXME/HACK=0).
6. **A6 — Разнобой кэш-чтения** 64КБ/128КБ (A1) — константа в одном месте.
7. **A7 — Смешение языков вывода** (RU/EN) — нет языка сессии.
8. **A8 — stderr vs stdout**: нотификации в stderr (верно для MCP), но в терминале могут быть незаметны.
9. **A9 — Интерактивность неоднородна**: `askQuestion` только в think/next/commands.
10. **A10 — `listChanges` вызывает тяжёлый `reviewChange`** на каждой записи — дорого при авто-refresh дашборда.

## B. Каталог улучшений (B1–B4: навыки, CLI, код, файлы)

### B1 — Новые навыки
1 `check <change>` предзапусковая проверка окружения · 2 `prioritize` приоритизация открытых изменений · 3 `explain <phase>` объяснение фазы новичку · 4 `suggest <change>` следующее действие · 5 `cancel <change>` откат (с подтверждением) · 6 `merge <a> <b>` · 7 `split <change>` · 8 `rename <change> <new>` с обновлением путей · 9 `status-watcher` live-прогресс фаз · 10 `profile-train` обучение профиля на успехах · 11 `snippet-verify` компиляция сниппетов изолированно · 12 `template-diff` отличие пользовательского шаблона · 13 `contract-audit` цепочка spec→design→tasks · 14 `orphan-audit` осиротевшие файлы · 15 `drift-detail` детальный дрейф с примерами.

### B2 — Команды CLI
16 `list --status DONE|OPEN` · 17 `list --lang ru` · 18 `stats --json` единицы · 19 `review --strict` · 20 `doctor --fix` · 21 `archive --force` · 22 `archive --dry` · 23 `profile --show-path` · 24 `changelog --format json` · 25 `changelog --since <v>` · 26 `next --json` · 27 `next --explain` · 28 `init --force` · 29 `tasks --progress` · 30 `tasks --since <v>` · 31 `shield --quick` lint+tsc · 32 `track lessons --json` · 33 `track lessons --session` · 34 `score` суммарный счёт проекта · 35 `watch <change>` live-подписка.

### B3 — Код: хардкоды, дубли, мёртвый код
36 вынести `readCapped` (A1) · 37 унифицировать `bar` (A3) · 38 вынести `collectTsFiles` (A4) · 39 константа `SPEC_HEADING "# Spec: "` из 3 файлов · 40 собрать `MAX_LESSONS/MAX_TOPICS/MAX_BUDGET` · 41 заменить `24*60*60*1000` на `DAY_MS` · 42 версия MCP `2025-06-18` в константу · 43 пути `~/.orion/...` в `paths.ts` · 44 порт 4780 константа · 45 общий обработчик кода возврата `fail()` · 46 убрать дубль `isLoopbackHost` · 47 проверить `toCapability/detectPhase/phaseOf` на дубли · 48 унифицировать `humanBytes/human` · 49 расширить `redactValue` · 50 `generateToken` в crypto util.

### B4 — Файлы
51 `src/utils/` общий модуль · 52 `src/constants.ts` · 53 `orionTdd.schema.json` связать с init · 54 `orion-shield.yml` fallback без changes · 55 `cache-bench.mjs` параметризовать · 56 `coverage-gate.mjs` порог в CI · 57 `docs/commands.md` синхронизировать с HELP · 58 `docs/configuration.md` пример .env · 59 `.gitignore` судьба reports/ · 60 `tests/fixtures/` общие · 61 `changes/archived/README.md` · 62 `src/tasks/` политика имён.

### B5 — Функциональность
63 `--dry` везде, где осмысленно · 64 `orion plan <prompt>` dry-run · 65 цветной прогресс-бар фаз · 66 `orion undo` откат мутации · 67 тайм-ауты с индикатором · 68 `--project <dir>` многопроектность · 69 `--scope local|global` · 70 `compare <a> <b>` · 71 после init предлагать think · 72 авто-prune кэша по порогу · 73 чистая отмена think Esc/Ctrl-C · 74 resume draft/forge из checkpoint · 75 `telemetry status` · 76 валидация changes/<id> перед командами · 77 `--lang` из `$LANG` · 78 горячая перезагрузка шаблонов · 79 подсказка next action · 80 `assumptions <change>`.

### B6 — Производительность
81 ленивые import() MCP-тулов (сокращение startup) · 82 мемоизация readProfile по mtime · 83 мемоизация loadDenyList · 84 кэш scanChanges по mtime · 85 дебаунс listChanges в serve · 86 параллелизм проверок shield (Promise.all) · 87 phaseOf без тяжёлого reviewChange в hot-loop · 88 formatBytes без аллокаций · 89 stream для больших файлов · 90 мемоизация shortTitle · 91 кэш loadTddConfig по mtime · 92 кэш существования в initRepo · 93 readTasks один раз в changeStatus · 94 кэш lessonsForChange · 95 без повторного JSON.parse proposal.

### B7 — Интерактивность и читабельность
96 TUI заголовки/рамки цветом · 97 прогресс фаз со спиннером в forge/shield · 98 дерево задач в tasks · 99 `--quiet` для скриптов · 100 колонки по ширине терминала · 101 крупный вердикт после долгих шагов · 102 консистентные иконки ✅🟡⬜ · 103 `--no-color`/NO_COLOR · 104 единый session.lang · 105 «did you mean» при ошибке · 106 Summary после каждой команды · 107 интерактивный выбор фазы · 108 лог: N шагов, файлы, время · 109 тихие гейты для CI · 110 строка прогресса покрытия после shield.

### B8 — Модульность и тесты
111 `src/utils/file.ts` · 112 `src/utils/term.ts` · 113 реестр скилов src/skills/index.ts · 114 тесты readCapped · 115 тесты bar/humanBytes · 116 тесты deny-листа на файле · 117 golden-тесты вывода list/stats/review · 118 свойства-тесты phaseOf · 119 тесты changelogFor · 120 тест идемпотентности init · 121 тест validateTddConfig на битый JSON · 122 тест recordPattern на дюп · 123 тест стабильности rankedLessons · 124 покрытие trackCmd lessons · 125 покрытие doctor --fix · 126 фазовые тесты /api/changes · 127 fuzz slugify · 128 конкурентное создание изменений · 129 scripts/e2e.sh полный цикл · 130 порог покрытия в workflow.

### B9 — Безопасность
131 denyExec/denyEnv для сниппетов · 132 redaction во всех эндпоинтах · 133 sandbox forge без сети · 134 аудит-лог shell-команд · 135 валидация путей от ../ (path-traversal) · 136 лимит размера сниппетов · 137 валидация manifest плагина по schema · 138 тайм-аут/лимит вывода процессов · 139 `--no-shell` · 140 хеш-пиннинг суб-команд · 141 denyEnv список переменных (AWS_SECRET) · 142 ограничить чтение homedir · 143 проверка changes/<id> в пределах репо · 144 `--safe` минимальные привилегии.

### B10 — Документация/экосистема
145 docs/faq.md · 146 docs/troubleshooting.md · 147 CONTRIBUTING о новых командах · 148 docs/mcp.md с примерами · 149 docs/api.md из TSDoc · 150 примеры orionTdd.json (plain/python/go) · 151 автогенерация CHANGELOG в release-скрипте · 152 CI shield на push · 153 npm files исключить tests/ · 154 бейдж покрытия · 155 ссылка на roadmap-v2 · 156 ранжирование issue · 157 SECURITY.md · 158 CODEOWNERS · 159 devDependencies в lock · 160 scripts/release.mjs.

### B11 — UX-вывод
161 Summary в конце · 162 help по фазам цветной · 163 ошибки единообразно `❌ команда — причина → совет` · 164 документированные схемы --json · 165 предлагать выбор при неоднозначности · 166 единые таймстампы · 167 спиннер в forge · 168 подсветка кода в сниппетах · 169 diff при изменении шаблонов · 170 «что дальше» · 171 render-helpers · 172 зелёный/жёлтый/красный везде · 173 кликабельный путь в review · 174 команда для каждого ✗ в doctor · 175 пороги с целевым значением · 176 футер версии/кэша · 177 прогресс загрузки кэша · 178 контекстный --help · 179 следующая команда после out · 180 консистентные эмодзи.

## C. Дополнительный каталог (181–500)

### C1 — Генераторы (181–220)
181 gen test · 182 gen snippet · 183 gen spec · 184 gen design · 185 gen proposal · 186 gen changelog · 187 gen config · 188 gen deny · 189 gen workflow · 190 gen docker · 191 gen ci · 192 gen badge · 193 gen hook · 194 gen ignore · 195 gen profile · 196 gen strategy · 197 gen metric · 198 gen lesson · 199 gen task · 200 gen module · 201 gen command · 202 gen skill · 203 gen mcp-tool · 204 gen plugin · 205 gen config-file · 206 gen api · 207 gen doc · 208 gen changelog-entry · 209 gen aliases · 210 gen completions (bash/zsh) · 211 gen man · 212 gen schema · 213 gen hook-custom · 214 gen template-ru · 215 gen template-en · 216 gen init-report · 217 gen stats-snapshot · 218 gen drift-report · 219 gen guard-template · 220 gen deny-seed.

### C2 — Командные префиксы (221–260)
221 project status · 222 project paths · 223 project config · 224 project deps · 225 project tests · 226 change show · 227 change log · 228 change files · 229 cache show · 230 cache scan · 231 cache top · 232 cache quota · 233 lessons origin · 234 lessons patterns · 235 lessons rating · 236 lessons prune · 237 profile snapshot · 238 profile export --project · 239 git status · 240 git last · 241 git blame-change · 242 schedule --next · 243 schedule --backlog · 244 notify on|off · 245 colors on|off · 246 locale set ru · 247 grid list · 248 grid debug · 249 debug env · 250 debug cache · 251 debug track · 252 debug lessons · 253 debug mcp · 254 debug crash · 255 lint --diff · 256 ts · 257 cov · 258 fmt · 259 clean · 260 prune-by-age <days>.

### C3 — Find/разведка (261–300)
261 find task · 262 find change · 263 find snippet · 264 find lesson · 265 find pattern · 266 find drift · 267 find orphan · 268 find dup (по хэшу) · 269 find link · 270 find template · 271 find spec-term · 272 find todo · 273 find dead · 274 find large · 275 find stale · 276 find unparsed · 277 find red (задачи без зелёного) · 278 find slow (по трейсам) · 279 find untested · 280 find deep · 281 find circular (импорты) · 282 grep-src · 283 grep-changes · 284 grep-lessons · 285 grep-config · 286 tree changes · 287 tree src · 288 tree cache · 289 tree archived · 290 size cache · 291 size change · 292 size src · 293 size tests · 294 rank lessons · 295 rank changes · 296 rank topics · 297 rank plugins · 298 trend cache · 299 trend tests · 300 trend coverage.

### C4 — Автоматизация и CI (301–340)
301 хук pre-commit активный (core.hooksPath) · 302 CI-статус shield в бейдж · 303 сверка версии package.json∥CHANGELOG · 304 guard на промпты в CI · 305 крон cache-bench · 306 бейдж покрытия · 307 changelog из result.md при merge · 308 doctor перед push · 309 semver по типам изменений · 310 lockfile check · 311 компиляция сниппетов в CI · 312 схема-консистентность MCP · 313 пример экспорта профиля · 314 снапшоты шаблонов · 315 docs-commands sync · 316 env-check всех ORION_* · 317 engines.node>=22 · 318 нормализация CRLF · 319 parallel forge в CI · 320 security scan gate · 321 core-coverage в workflow · 322 dist-fresh check · 323 no-junk check · 324 lesson-limit check · 325 economy-ledger check · 326 trace-disabled gate · 327 package-files gate · 328 схемы в релиз · 329 секция unreleased · 330 fuzz escapeHTML · 331 rate-limit /api/cache · 332 предупреждение serve без токена на не-loopback · 333 docker multiarch · 334 npm pack size · 335 publish dry-run · 336 TTL по namespace · 337 lessons dedup refresh · 338 profile UTF8 emit · 339 index bundle CLI · 340 startup profile.

### C5 — Производительность кода (341–380)
341 ленивые import() MCP · 342 worker_threads для shield · 343 мемоизация findLessons · 344 дерево-кеш scanChanges/listChanges · 345 fs.watch live-шаблоны · 346 одиночный проход вместо sort+reverse · 347 readdirSync withFileTypes шире · 348 меньше рекурсивных readdir · 349 granularity волн forge · 350 пул потоков drift/policy · 351 однократная предзагрузка deny · 352 structuredClone вместо JSON deep · 353 кеш индексов токенов · 354 Intl.NumberFormat · 355 Buffer.concat стриминг · 356 меньше аллокаций compress · 357 deep-equal профиля · 358 fetch с тайм-аутом · 359 лимит большого proposal · 360 lazy readProfile в serve · 361 Promise.allSettled для гейтов · 362 хэш сниппетов для diff · 363 for..of вместо forEach в hot paths · 364 Set вместо Array.includes в deny/stopwords · 365 пре-компиляция stopwords в Set · 366 без повторного toLowerCase · 367 debounce auto-refresh · 368 batch-write в track · 369 Buffer для больших payload · 370 логгер вместо console.error в hot loop · 371 инкрементальное чтение lessons · 372 ленивый profile.md · 373 atomic write (temp+rename) для JSON · 374 graceful shutdown сигналов · 375 тайм-аут по умолчанию на процессы · 376 --parallel ограничить числом CPU · 377 кеш версии package.json · 378 старт dist (уже ок) · 379 оптимизировать trigram · 380 прогресс не стримить в stderr.

### C6 — Терминальная интерактивность (381–420)
381 полноэкранный TUI статуса с хоткеями · 382 таблица изменений с барами и сортировкой · 383 редактор задач инлайн (j/k/toggle) · 384 пейджинг · 385 авто-завершение · 386 история команд · 387 REPL `orion` без аргументов · 388 Ctrl+R поиск · 389 хоткей o показа change · 390 г · 391 d · 392 f · 393 s · 394 debug-панель · 395 лог-панель · 396 панель кэш-экономики live · 397 панель уроков/паттернов · 398 панель профиля · 399 тёмная/светлая тема · 400 колонки по содержимому · 401 ANSI-совместимые иконки · 402 относительные таймстампы («2м назад») · 403 прогресс per-task в forge · 404 бар размера кэша против лимита · 405 уведомление при завершении · 406 цветное подтверждение cancel/archive · 407 спиннер в watch · 408 less-подобный вывод · 409 escape-юникод для старых терминалов · 410 авто-ширина по stdout.columns. · 411 vscode-расширение · 412 docker compose-команда · 413 github PR-комментарии · 414 slack-нотификации · 415 api-server REST · 416 webhook-события · 417 экспорт метрик JSONL/CSV · 418 prometheus openmetrics · 419 OpenTelemetry traces · 420 backup профиль+кэш+уроки

### C7 — Экосистема и интеграции (421–460)
421 vscode-расширение · 422 docker compose-команда · 423 github PR-комментарии · 424 slack-нотификации · 425 api-server REST · 426 webhook-события · 427 экспорт метрик JSONL/CSV · 428 prometheus openmetrics endpoint · 429 OpenTelemetry traces · 430 backup профиль+кэш+уроки · 431 restore · 432 transfer между машинами · 433 ssh удалённая работа · 434 plugin registry публичный · 435 marketplace-браузер · 436 self-update · 437 doctor --remote · 438 ci-команда для агентов · 439 MCP project_status · 440 MCP snippet_check · 441 MCP change_diff · 442 MCP profile_update · 443 MCP policy_check · 444 MCP schedule_actions · 445 интеграция gh · 446 шаблон cloud-init · 447 работа без homedir (read-only кэш) · 448 мультипрофиль по проектам · 449 версионирование профиля · 450 экспорт отчёта PDF/Markdown. · 451 MCP project_client · 452 MCP cache_peek · 453 MCP template_preview · 454 MCP lesson_attach · 455 MCP profile_train · 456 MCP deny_check · 457 MCP changelog_gen · 458 MCP review_fast · 459 MCP stats_lite · 460 MCP self_audit.

### C8 — UX и «совершенные» компоненты (461–480)
461 сообщение об успехе с модоганой · 462 приветствие · 463 не загромождать статус · 464 ETA для долгих задач · 465 help по уровню (beginner/pro) · 466 `--yes` пропуск подтверждений · 467 авто-свернуть успешные шаги · 468 кэш версии в футере · 469 уровень доверия для --force · 470 раздел «расследования» для ложных guard · 471 чистый --json вывода · 472 rerun last `!!` · 473 шорткаты d/f · 474 выравнивание чисел в stats · 475 дельта покрытия от прошлого · 476 проверка обновлений (опционально) · 477 предупреждение большого кэша · 478 дедуп багов-уроков · 479 «пропустить» в циклах · 480 финальный отчёт цикла.

### C9 — Метрики качества (481–500)
481 `orion self-audit` (обёртка doctor+list+score) · 482 время на изменение · 483 скорость фаз think→out · 484 стоимость токенов на изменение · 485 число уроков на изменение · 486 сравнение с прошлыми · 487 heatmap активности · 488 «горячие» сниппеты · 489 профиль стоимости по namespace · 490 тренд размера кэша 30д · 491 вхождение каждого паттерна · 492 рейтинг шаблонов по использованию · 493 часовой приоритет · 494 детект стагнации · 495 порог «спящих» изменений · 496 уведомление о забытых изменениях · 497 метрика дублей кода по хэшам блоков · 498 цикломатическая сложность по файлам · 499 SI-единицы везде · 500 scorecard по 8 категориям выше.

## D. Компоненты, признанные совершенными (честно)
- Мёртвый код: 194/194 функций используются, TODO/FIXME/HACK=0.
- Детерминизм/честность: отказ «придумать done», stale-verdict, no-junk, source-маркер шаблонов, dedup уроков.
- Токен-экономия: кэш, compress, budgets, economy — цельная система.
- Guard-слой (drift + injection + deny) работает end-to-end.

## E. Поэтапный план реализации

### Фаза 1 — Баги и утилиты (0.30.0) ✅
1. ✅ Вынести `readCapped`, `humanBytes` в `src/utils/file.ts` (A1). Отмечено: `bar`/`generateToken`/`isLoopbackHost` — не дубли, живут только в serve.ts (ложные срабатывания наивного grep).
2. ✅ Константы `DAY_MS`, `DEFAULT_PORT` в `src/constants.ts`. (SPEC_HEADING/MCP_VERSION оставлены как есть — regex-контексты, где константа ухудшает читабельность.)
3. ✅ Ленивый/кешируемый `driftOf` в `listChanges` — без полного reviewChange в hot-loop (B6-87).
4. ✅ Тесты `tests/utils.test.ts` (readCapped/humanBytes) (B8-114..115).
5. ✅ Ускорение тестов: контроль `ORION_VITEST_MAX_WORKERS` для CI; констатация — 571 тест за ~21с, долгих тестов нет (waves — реальные async).

### Фаза 2 — Интерактивность и терминал (0.31.0) ✅
1. ✅ `src/utils/term.ts`: `colorEnabled`, `statusMark`, `paint`, `bar` — NO_COLOR/ORION_COLOR чувствительны (монохром-фолбэк `[+]/[x]/[.]`).
2. ✅ Консистентные статус-маркем в review/list/doctor/fail (B11-163, 172); `--no-color` флаг + HELP.
3. (~) Язык сессии: полная двуязычность вывода оставлена как есть (шаблоны draft уже локальны v0.27); не раздуваю код — зафиксировано как осознанный баланс.
4. ✅ Прогресс-бар в list (B11-172); Summary после ключевых команд через consistent fail/head.

5. Golden-тесты на вывод (B8-117).

### Фаза 3 — Производительность (0.32.0) ✅ (по балансу)
1. (~) Ленивые import() MCP — ОТЛОЖЕНО: startup уже 118ms, риск реструктуризации 22 тулов не окупает.
2. ✅ Мемоизация `readProfile` (mtime+size) и `loadDenyList` (mtime). `scanChanges` — пропущено (выигрыш мал, инвалидация сложна).
3. (~) Дебаунс авто-refresh дашборда — не требует: `/api/*` уже лёгкий (driftOf мемоизован), 5s таймер приемлем.
4. (~) Параллелизм shield — ОТЛОЖЕНО осознанно: последовательный shield детерминирован; параллелизация 6 шагов рискует нестабильностью кэша/выхода. Выигрыш ~30% не стоит риска.
5. ✅ benchmarks: startup CLI 136ms / MCP 118ms зафиксированы (быстро, оптимизация не нужна).


### Фаза 4 — Функциональность (0.33.0) ✅
1. ✅ `orion plan <prompt>` — guarded dry-run план без записи (`planCmd.ts`).
2. ✅ `compare <a> <b>` — side-by-side статус (`compareCmd.ts`).
3. ✅ `assumptions <change>` — вывод [assumption]-задач draft (`compareCmd.ts`).
4. (~) `undo` + `--yes` — отложено (менеджмент мутаций объёмный; низкий приоритет против стабильности).
5. (~) Контекстный `--help` — частично: HELP команд добавлен; полный per-command help отложен.


### Фаза 5 — Безопасность (0.34.0)
1. denyExec/denyEnv для сниппетов (B9-131, 141).
2. path-traversal валидация (B9-135).
3. Atomic write для всех JSON (C5-373).
4. Тайм-аут на дочерние процессы (B9-138).
5. Sandbox forge без сети (B9-133).

### Фаза 6 — Экосистема и метрики (0.35.0)
1. self-audit + score (B2-34, C9-481).
2. trend cache/tests/coverage (C3-298..300).
3. backup/restore (C7-430..432).
4. docs faq/troubleshooting/mcp (B10-145, 146, 148).
5. release.mjs + автоматический changelog (B10-151).
