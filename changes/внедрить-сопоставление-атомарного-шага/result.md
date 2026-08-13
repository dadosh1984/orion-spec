# Result — внедрить-сопоставление-атомарного-шага

- **Status:** INCOMPLETE
- **Tasks:** 48/53 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS — **STALE**: the change moved after the last `orion shield` run (2026-08-13T20:00:19.559Z)
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-13T20:00:19.559Z

## Checklist

- [x] [fact] `src/core/skillsMatch.ts` — BM25/TF-IDF скоринг по нормализованной строке действия + description + tags (self-contained, без внешних пакетов и сети). IDF строится на лету из каталога `scripts/`
- [x] [fact] Эволюционировать `RunManifest` (src/core/runtime.ts): добавить `tags: string[]`, `domain: string` (напр. `onec` / `contracts` / `general`), `environmentFingerprint?: string`
- [x] [fact] Домен-фильтр ДО матчинга: кандидаты только из `domain === currentProjectDomain`, затем BM25. Защита от ложного кросс-доменного совпадения («создать запись» в 1С vs контракт-бот)
- [x] [fact] Консервативные пороги без ложных срабатываний: top-1 с большим отрывом → `USE_SKILL`; пограничный → вернуть короткий список для LLM-верификации; ниже → `NO_MATCH` (идёт в LLM). Ложное срабатывание дороже ложного отказа — порог смещён в консервативную сторону
- [x] [fact] **Миss-лог с первого дня** (`src/core/skillMissLog.ts`): каждый `NO_MATCH`/пограничный случай пишется — шаг, дата, domain, что не нашлось, что сделала LLM. Единственная обязательная инфраструктура; без неё нельзя тюнить пороги и искать кандидатов на промоушен
- [x] [fact] Поиск повторяющихся сигнатур в миss-логе (`promotionCandidates`): сигнатура, повторившаяся >= 3 раз → кандидат на промоушен (`orion run match --promote`)
- [ ] [fact] Промоушен НЕ автоматический: кандидат выносится на подтверждение пользователя (`orion run --approve <sig>`). Точность скрипта стоит дороже лишнего клика — никакого автопромоушена с ревью
- [ ] [assumption] Перед записью в реестр `registerScript`: прогнать сгенерированный скрипт на исторических входах/выходах из миss-лога и сверить результат (replay), иначе не регистрировать
- [x] [fact] Новый skill при регистрации может получить консервативные права (`sandbox.network`), полный доступ НЕ раздаётся по умолчанию через `run generate`-визард
- [ ] [fact] Метрика окупаемости с первого дня: `steps_via_skill` vs `steps_via_llm`, сэкономленные токены/время (счётчик для метрики — след. итерация)
- [x] [fact] Отпечаток окружения в `RunManifest` (`environmentFingerprint` + `environmentFingerprint()` в skillsMatch): пишется сейчас, инвалидация — фаза 4 при сигнале из живого кейса (напр. 1C_TI→1C_TI_NEW)
- [x] [assumption] Тесты `tests/skills-match.test.ts`: BM25 скоринг (точное совпадение > перефразировки), домен-фильтр, пороги (USE_SKILL/верификация/NO_MATCH), миss-лог пишется + promotionCandidates
- [x] [control] `pnpm run build` + eslint + tsc зелёные, полный vitest pass (70 файлов / 768 тестов)
- [ ] [assumption] Фаза 3: эмбеддинги — ТОЛЬКО если миss-лог покажет системный провал BM25 на перефразированных шагах
- [ ] [assumption] Фаза 4: полноценная инвалидация по `environmentFingerprint` — при живом кейсе миграции схемы
- [x] [fact] `matchSkill` — чистый/синхронный/детерминированный (matched / none / ambiguous), НЕ зовёт LLM (functional core)
- [x] [fact] скоринг нормализован в [0,1] (score/max) — порог 0.45 осмыслен вне корпуса
- [x] [fact] `resolveAmbiguous` — отдельная async; одна пара функций для run/forge и CLI
- [x] [fact] `shadowCompare` + `orion run match --shadow` — BM25 vs naive на тех же кейсах (наивный удаляется с данными, не вслепую)
- [x] [control] full vitest 70 файлов / 769 тестов, eslint/tsc зелёные, shield allPass
- [x] [fact] `resolveDomain()`: поряr `.orion/config.json` → `ORION_DOMAIN` env → `general`; убит хардкод домена в runCmd (miss-log и match берут настоящий домен)
- [x] [fact] БАГ-fix `resolveAmbiguous`: multi-candidate возвращает `none` (не топ) — error asymmetry, не угадываем
- [x] [assumption] тесты `resolveDomain` (env/config/general) + `resolveAmbiguous` (none/matched)
- [x] [control] full vitest 70 файлов / 774 теста, eslint/tsc зелёные, shield allPass
- [x] [fact] fix #1 — тавтология `tier`: убран `skills.some(...)`, exact теперь = все токены имени skill в запросе; `tier=bm25` честно выводится
- [x] [fact] fix #2 — единый путь: `router.routeRequest` и `commands` (think/draft-подсказки) переведены на BM25 `matchSkill`; мёртвый `findExistingSkill` удалён
- [x] [fact] fix #3 — `createScript`/generator/--save-as заполняют `domain`(resolveDomain) + `environmentFingerprint` при создании
- [x] [assumption] тесты router переведены с findExistingSkill на matchSkill
- [x] [control] full vitest 70 файлов / 774 теста, eslint/tsc зелёные, live-проверка tier=bm25 + domain/envfp заполнены
- [x] [fact] tier-регрессия: добавлены тесты tier=bm25 (шаг не называет skill) и tier=exact (все термины имени в запросе) — раньше tier вообще не тестировался
- [x] [fact] env-fingerprint теперь живёт: matchSkill понижает до ambiguous skill с отличающимся отпечатком, даже при высоком BM25-score (иначе — декларация без последствий)
- [x] [assumption] тесты: stale → ambiguous, fresh → matched, tier bm25/exact
- [x] [control] full vitest 70 / 778, eslint/tsc зелёные
- [x] [fact] `orion run match --approve "<sig>"`: из повторной сигнатуры miss-log создаёт change-скелет `changes/<slug>/` с replay-задачами (историч. вход→ожидаемый выход)
- [x] [fact] НЕ авто-register: требует ≥3 повторов И ручной `entry.js` → `forge --save-as`. Тихое создание скрипта невозможно
- [x] [fact] `missLogForStep()` — собирает все историч. I/O по сигнатуре (данные для replay-верификации)
- [x] [assumption] тесты missLogForStep (случай-независимость, неизвестная сигнатура → [])
- [x] [control] full vitest 70 файлов / 780 тестов, eslint/tsc зелёные, live-прогон --approve создаёт скелет
- [x] [fact] `src/core/promotion.ts`: state-machine proposed→replayed→approved с ledger в `.orion/proposals/<id>.json`
- [x] [fact] `orion run match --propose "<sig>"` — снапшот повторяющейся сигнатуры (≥3) + scaffold changes/
- [x] [fact] `orion run match --replay <id>` — shadow-запуск скрипта на исторических входах, drift БЛОКИРУЕТ промоушен (state остаётся proposed)
- [x] [fact] `orion run match --approve <id>` — только после PASSED replay; пишет economy.json с source {proposalId, promotedAt, replayScore}
- [x] [fact] A2: `EconomyEntry.source` добавлен — ROI по конкретному промоушену, не «вообще»
- [x] [assumption] тесты `tests/promotion.test.ts`: propose/replay-block/replay-pass/approve-refused/approve-ok (5)
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные, live-прогон state-machine
- [x] [fact] B1: `orion --help` теперь генерируется из живого `ORION_REGISTRY` (8 команд), а не из захардкоженной константы с 44 устаревшими командами
- [x] [fact] C1: парсинг argv переписан на `node:util` `parseArgs` (zero-deps, без кастомного цикла); командно-специфичные флаги (--diff/--assumptions/--tasks/...) сохраняются в args для handlers
- [x] [assumption] smoke: `--help`=8, `--json`, `--version`, deprecated-алиасы, `run match --promote`
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные
- [x] [fact] 2.1: `orion init` — убран отдельный case; `init` стал deprecated-алиасом → `doctor --init` (inject --init). Логика initRepo — один источник в doctor.ts
- [x] [fact] 2.2: `out` авто-вызывает pay-debt (детерминированно, игл ledger) и пишет секцию "YAGNI debt (auto-repaid on out)" в result.md
- [x] [fact] pay-debt больше не отдельный dispatch; standalone — тонкий триггер → тот же handler (throw на missing change); `change --pay-debt` оставлен
- [x] [control] full vitest 71 файлов / 785 тестов, eslint/tsc зелёные, live: init→doctor, out auto-repay с секцией Debt

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  71 passed (71)
      Tests  785 passed | 2 skipped (787)
   Duration  24.44s (transform 8.36s, setup 0ms, import 18.19s, tests 138.49s, environment 25ms)

[orion: −38686 B (−99.3%) ≈ 9672 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | 1 snippet(s) within repo norms (median 95 LOC, 3 imports) |
| economy | PASS | cache 36.6 KB of 100.0 MB (102 entries) — within budget; ≈ 1175124 tok saved across 601 compress op(s) |
| security | PASS | no obvious issues |
| policy | PASS | no .orion/policy.json — no project gates to enforce |
| verifiability | PASS | oracles: ci, lint, test-runner, type-check · verifiability level 3 — strong checks present |

## Artifacts

- `changes/внедрить-сопоставление-атомарного-шага/proposal.md`
- `changes/внедрить-сопоставление-атомарного-шага/design.md`
- `changes/внедрить-сопоставление-атомарного-шага/tasks.md`
- `reports/внедрить-сопоставление-атомарного-шага/guard-report.md`
- `changes/внедрить-сопоставление-атомарного-шага/specs/skills_match/spec.md`
- `changes/внедрить-сопоставление-атомарного-шага/snippets/`

## YAGNI debt (auto-repaid on out)

- Paid during this out: none
- Still owed: none — no open debt
- Open debt entries after: 0

## Honest Receipt

```
╭─ Honest Receipt ──────────────────────╮
│ change:        внедрить-сопоставление-атомарного
│ ts:            2026-08-13T20:00:19.559Z
│ spec ↔ source: 1/1 symbols matched
│ tests:         785 passing, 2 skipped
│ coverage:      not measured
│ hazards:       0 destructive patterns
│ sha256:        98bc3708364c
╰───────────────────────────────────────╯
```

## Next steps

The guard report is **stale** — the change moved after the last `orion shield внедрить-сопоставление-атомарного-шага` run. Re-run it before trusting this result.
