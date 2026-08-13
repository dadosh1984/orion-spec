# Задачи — внедрить-сопоставление-атомарного-шага

Легенда: `- [x]` готово, `- [ ]` открыто. Этапы по принципу
«не строить всё сразу»: фаза 1 без ML, инфраструктура промахов с первого
дня, промоушен строго с подтверждением. Фазы 3 (эмбеддинги) и 4
(протухание) — только при появлении сигнала в логах.

## Фаза 1 — минимум, без ML

- [x] [fact] `src/core/skillsMatch.ts` — BM25/TF-IDF скоринг по нормализованной строке действия + description + tags (self-contained, без внешних пакетов и сети). IDF строится на лету из каталога `scripts/`
- [x] [fact] Эволюционировать `RunManifest` (src/core/runtime.ts): добавить `tags: string[]`, `domain: string` (напр. `onec` / `contracts` / `general`), `environmentFingerprint?: string`
- [x] [fact] Домен-фильтр ДО матчинга: кандидаты только из `domain === currentProjectDomain`, затем BM25. Защита от ложного кросс-доменного совпадения («создать запись» в 1С vs контракт-бот)
- [x] [fact] Консервативные пороги без ложных срабатываний: top-1 с большим отрывом → `USE_SKILL`; пограничный → вернуть короткий список для LLM-верификации; ниже → `NO_MATCH` (идёт в LLM). Ложное срабатывание дороже ложного отказа — порог смещён в консервативную сторону
- [x] [fact] **Миss-лог с первого дня** (`src/core/skillMissLog.ts`): каждый `NO_MATCH`/пограничный случай пишется — шаг, дата, domain, что не нашлось, что сделала LLM. Единственная обязательная инфраструктура; без неё нельзя тюнить пороги и искать кандидатов на промоушен

## Фаза 2 — промоушен (строго с подтверждением)

- [x] [fact] Поиск повторяющихся сигнатур в миss-логе (`promotionCandidates`): сигнатура, повторившаяся >= 3 раз → кандидат на промоушен (`orion run match --promote`)
- [ ] [fact] Промоушен НЕ автоматический: кандидат выносится на подтверждение пользователя (`orion run --approve <sig>`). Точность скрипта стоит дороже лишнего клика — никакого автопромоушена с ревью
- [ ] [assumption] Перед записью в реестр `registerScript`: прогнать сгенерированный скрипт на исторических входах/выходах из миss-лога и сверить результат (replay), иначе не регистрировать
- [x] [fact] Новый skill при регистрации может получить консервативные права (`sandbox.network`), полный доступ НЕ раздаётся по умолчанию через `run generate`-визард

## Контроль качества (сквозь фазы 1-2)

- [ ] [fact] Метрика окупаемости с первого дня: `steps_via_skill` vs `steps_via_llm`, сэкономленные токены/время (счётчик для метрики — след. итерация)
- [x] [fact] Отпечаток окружения в `RunManifest` (`environmentFingerprint` + `environmentFingerprint()` в skillsMatch): пишется сейчас, инвалидация — фаза 4 при сигнале из живого кейса (напр. 1C_TI→1C_TI_NEW)
- [x] [assumption] Тесты `tests/skills-match.test.ts`: BM25 скоринг (точное совпадение > перефразировки), домен-фильтр, пороги (USE_SKILL/верификация/NO_MATCH), миss-лог пишется + promotionCandidates
- [x] [control] `pnpm run build` + eslint + tsc зелёные, полный vitest pass (70 файлов / 768 тестов)

## Отложено (только при сигнале из логов)

- [ ] [assumption] Фаза 3: эмбеддинги — ТОЛЬКО если миss-лог покажет системный провал BM25 на перефразированных шагах
- [ ] [assumption] Фаза 4: полноценная инвалидация по `environmentFingerprint` — при живом кейсе миграции схемы

## Развилки (v0.51, принято от пользователя)

- [x] [fact] `matchSkill` — чистый/синхронный/детерминированный (matched / none / ambiguous), НЕ зовёт LLM (functional core)
- [x] [fact] скоринг нормализован в [0,1] (score/max) — порог 0.45 осмыслен вне корпуса
- [x] [fact] `resolveAmbiguous` — отдельная async; одна пара функций для run/forge и CLI
- [x] [fact] `shadowCompare` + `orion run match --shadow` — BM25 vs naive на тех же кейсах (наивный удаляется с данными, не вслепую)
- [x] [control] full vitest 70 файлов / 769 тестов, eslint/tsc зелёные, shield allPass

## Проверка кодом + фиксы (v0.51)

- [x] [fact] `resolveDomain()`: поряr `.orion/config.json` → `ORION_DOMAIN` env → `general`; убит хардкод домена в runCmd (miss-log и match берут настоящий домен)
- [x] [fact] БАГ-fix `resolveAmbiguous`: multi-candidate возвращает `none` (не топ) — error asymmetry, не угадываем
- [x] [assumption] тесты `resolveDomain` (env/config/general) + `resolveAmbiguous` (none/matched)
- [x] [control] full vitest 70 файлов / 774 теста, eslint/tsc зелёные, shield allPass

## Единый матчер + заполнение мета (3 фикса)

- [x] [fact] fix #1 — тавтология `tier`: убран `skills.some(...)`, exact теперь = все токены имени skill в запросе; `tier=bm25` честно выводится
- [x] [fact] fix #2 — единый путь: `router.routeRequest` и `commands` (think/draft-подсказки) переведены на BM25 `matchSkill`; мёртвый `findExistingSkill` удалён
- [x] [fact] fix #3 — `createScript`/generator/--save-as заполняют `domain`(resolveDomain) + `environmentFingerprint` при создании
- [x] [assumption] тесты router переведены с findExistingSkill на matchSkill
- [x] [control] full vitest 70 файлов / 774 теста, eslint/tsc зелёные, live-проверка tier=bm25 + domain/envfp заполнены

## Каркас по проверке пользователя (реальные баги + регрессия)

- [x] [fact] tier-регрессия: добавлены тесты tier=bm25 (шаг не называет skill) и tier=exact (все термины имени в запросе) — раньше tier вообще не тестировался
- [x] [fact] env-fingerprint теперь живёт: matchSkill понижает до ambiguous skill с отличающимся отпечатком, даже при высоком BM25-score (иначе — декларация без последствий)
- [x] [assumption] тесты: stale → ambiguous, fresh → matched, tier bm25/exact
- [x] [control] full vitest 70 / 778, eslint/tsc зелёные

## A1 — безопасный промоушен (--approve + replay-сид)

- [x] [fact] `orion run match --approve "<sig>"`: из повторной сигнатуры miss-log создаёт change-скелет `changes/<slug>/` с replay-задачами (историч. вход→ожидаемый выход)
- [x] [fact] НЕ авто-register: требует ≥3 повторов И ручной `entry.js` → `forge --save-as`. Тихое создание скрипта невозможно
- [x] [fact] `missLogForStep()` — собирает все историч. I/O по сигнатуре (данные для replay-верификации)
- [x] [assumption] тесты missLogForStep (случай-независимость, неизвестная сигнатура → [])
- [x] [control] full vitest 70 файлов / 780 тестов, eslint/tsc зелёные, live-прогон --approve создаёт скелет

## A1/A2 — state-machine промоушен + economy-source

- [x] [fact] `src/core/promotion.ts`: state-machine proposed→replayed→approved с ledger в `.orion/proposals/<id>.json`
- [x] [fact] `orion run match --propose "<sig>"` — снапшот повторяющейся сигнатуры (≥3) + scaffold changes/
- [x] [fact] `orion run match --replay <id>` — shadow-запуск скрипта на исторических входах, drift БЛОКИРУЕТ промоушен (state остаётся proposed)
- [x] [fact] `orion run match --approve <id>` — только после PASSED replay; пишет economy.json с source {proposalId, promotedAt, replayScore}
- [x] [fact] A2: `EconomyEntry.source` добавлен — ROI по конкретному промоушену, не «вообще»
- [x] [assumption] тесты `tests/promotion.test.ts`: propose/replay-block/replay-pass/approve-refused/approve-ok (5)
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные, live-прогон state-machine

## B1/C1 — правда в интерфейсе (справка + парсинг)

- [x] [fact] B1: `orion --help` теперь генерируется из живого `ORION_REGISTRY` (8 команд), а не из захардкоженной константы с 44 устаревшими командами
- [x] [fact] C1: парсинг argv переписан на `node:util` `parseArgs` (zero-deps, без кастомного цикла); командно-специфичные флаги (--diff/--assumptions/--tasks/...) сохраняются в args для handlers
- [x] [assumption] smoke: `--help`=8, `--json`, `--version`, deprecated-алиасы, `run match --promote`
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные

## 2.1/2.2 — структура стойкая до Honest Receipt

- [x] [fact] 2.1: `orion init` — убран отдельный case; `init` стал deprecated-алиасом → `doctor --init` (inject --init). Логика initRepo — один источник в doctor.ts
- [x] [fact] 2.2: `out` авто-вызывает pay-debt (детерминированно, игл ledger) и пишет секцию "YAGNI debt (auto-repaid on out)" в result.md
- [x] [fact] pay-debt больше не отдельный dispatch; standalone — тонкий триггер → тот же handler (throw на missing change); `change --pay-debt` оставлен
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные, live: init→doctor, out auto-repay с секцией Debt

## 2.3 — Honest Receipt (killer-feature)

- [x] [fact] `src/skills/out/receipt.ts`: receipt из реальных данных guard (drift/test/hazard) + честный "not measured" для coverage
- [x] [fact] поля: change, ts (stable), spec↔source, tests, coverage, hazards, sha256
- [x] [fact] text-блок в result.md + машиночитаемый `receipt.json`
- [x] [fact] receipt.ts не в projectHash (CONTEXT_OUTPUTS) — out не ядовит freshness; ts из guard/артефактов (идемпотентен)
- [x] [fact] coverage: берётся только из реального coverage/coverage-final.json; иначе "not measured"
- [x] [assumption] тесты tests/receipt.test.ts (6): не-измеримый coverage, стабильный sha256, парсинг test, текст-блок, идемпотентность
- [x] [control] full vitest 72 файла / 791 тест, eslint/tsc зелёные
