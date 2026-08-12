# Forge Report — v0-46-устранить-дубли

- **Status:** paused
- **Done:** 0 · **Skipped (cache):** 0 · **Pending:** 10
- **Generated:** 2026-08-11T21:37:41.509Z

| Task | Status |
|------|--------|
| 1. Унифицировать `collectTsFiles`: вынести в `src/utils/file.ts`, убрать дубли из `scaleStages/reuse.ts` и `skills/shield/policy.ts` | pending |
| 2. Унифицировать `human`/`humanBytes`: заменить `human()` в `serve.ts` на `humanBytes` из `utils/file.ts` | pending |
| 3. Унифицировать `bar`: заменить локальную `bar(v,m)` в `serve.ts` на `bar` из `utils/term.ts` | pending |
| 4. Вынести `isLoopbackHost` в `src/utils/net.ts` | pending |
| 5. Вынести `generateToken` в `src/utils/crypto.ts` | pending |
| 6. Вынести `redactValue` в `src/utils/redact.ts` | pending |
| 7. Добавить `fail()` в `src/utils/term.ts` — общий обработчик кода возврата с сообщением и exit(1) | pending |
| 8. Расширить `src/constants.ts`: `MAX_BUDGET`, пути `~/.orion/...` | pending |
| 9. Тесты: покрыть все новые/перемещённые утилиты | pending |
| 10. Линт + tsc + тесты — все гейты зелёные | pending |

Waiting for implementation snippets:
- `changes/v0-46-устранить-дубли/snippets/1_унифицировать_collecttsfiles.ts`
- `changes/v0-46-устранить-дубли/snippets/2_унифицировать_human.ts`
- `changes/v0-46-устранить-дубли/snippets/3_унифицировать_bar.ts`
- `changes/v0-46-устранить-дубли/snippets/4_вынести_isloopbackhost.ts`
- `changes/v0-46-устранить-дубли/snippets/5_вынести_generatetoken.ts`
- `changes/v0-46-устранить-дубли/snippets/6_вынести_redactvalue.ts`
- `changes/v0-46-устранить-дубли/snippets/7_добавить_fail.ts`
- `changes/v0-46-устранить-дубли/snippets/8_расширить_src.ts`
- `changes/v0-46-устранить-дубли/snippets/9_тесты_покрыть.ts`
- `changes/v0-46-устранить-дубли/snippets/10_линт_tsc.ts`
