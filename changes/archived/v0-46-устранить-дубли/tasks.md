# Задачи — v0-46-устранить-дубли

- [ ] 1. Унифицировать `collectTsFiles`: вынести в `src/utils/file.ts`, убрать дубли из `scaleStages/reuse.ts` и `skills/shield/policy.ts`
- [ ] 2. Унифицировать `human`/`humanBytes`: заменить `human()` в `serve.ts` на `humanBytes` из `utils/file.ts`
- [ ] 3. Унифицировать `bar`: заменить локальную `bar(v,m)` в `serve.ts` на `bar` из `utils/term.ts`
- [ ] 4. Вынести `isLoopbackHost` в `src/utils/net.ts`
- [ ] 5. Вынести `generateToken` в `src/utils/crypto.ts`
- [ ] 6. Вынести `redactValue` в `src/utils/redact.ts`
- [ ] 7. Добавить `fail()` в `src/utils/term.ts` — общий обработчик кода возврата с сообщением и exit(1)
- [ ] 8. Расширить `src/constants.ts`: `MAX_BUDGET`, пути `~/.orion/...`
- [ ] 9. Тесты: покрыть все новые/перемещённые утилиты
- [ ] 10. Линт + tsc + тесты — все гейты зелёные
