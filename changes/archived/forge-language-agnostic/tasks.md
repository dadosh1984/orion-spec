# Задачи — forge-language-agnostic

- [x] **T1: Абстракция ForgeConfig + автодетект языка** — `src/core/forgeConfig.ts`
- [x] **T2: GradleForgeConfig** — реализация Java/Gradle в `src/core/forgeConfig.ts`
- [x] **T3: Рефакторинг tddCore.ts — загрузка конфига** — `loadTddConfig()` вызывает `detectForgeConfig()`
- [x] **T4: Рефакторинг tddCore.refactor() — через конфиг** — `refactor()` из `ForgeConfig`
- [x] **T5: Поддержка .java сниппетов** — `resolveSnippet()` с параметром расширения
- [x] **T6: Тесты Java/Gradle цикла** — `tests/forge-config.test.ts` (16 тестов)
- [x] **T7: Документация** — пример `orionTdd.json` для Java в `docs/configuration.md`
