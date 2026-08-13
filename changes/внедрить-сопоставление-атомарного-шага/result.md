# Result — внедрить-сопоставление-атомарного-шага

- **Status:** INCOMPLETE
- **Tasks:** 10/15 done
**Guard:** lint:PASS, type:PASS, test:PASS, drift:PASS, yagni:PASS, economy:PASS, security:PASS, policy:PASS, verifiability:PASS
- **Budget:** compact
- **Constraints:** compact
- **Generated:** 2026-08-13T18:51:05.211Z

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

## Guard report

| Step | Status | Detail |
|------|--------|--------|
| lint | PASS | $ eslint src --max-warnings=0
 |
| type | PASS | ok |
| test | PASS | [orion] 1 failing line(s):
🧠 orion lesson recorded — forge: task not green: Implement add — expected 2 to equal 3
 Test Files  70 passed (70)
      Tests  768 passed | 2 skipped (770)
   Duration  23.67s (transform 6.29s, setup 0ms, import 16.69s, tests 135.88s, environment 26ms)

[orion: −38686 B (−99.3%) ≈ 9672 tok — ≈ tokens: bytes/4 estimate (no tokenizer)] |
| drift | PASS | matched 1 exported capabilities |
| yagni | PASS | 1 snippet(s) within repo norms (median 92 LOC, 3 imports) |
| economy | PASS | cache 31.7 KB of 100.0 MB (93 entries) — within budget; ≈ 1097752 tok saved across 577 compress op(s) |
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

## Next steps

Complete the 5 open task(s): `orion forge внедрить-сопоставление-атомарного-шага`.
