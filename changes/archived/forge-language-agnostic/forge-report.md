# Forge Report — forge-должен-выполнять-red

- **Status:** paused
- **Done:** 0 · **Skipped (cache):** 0 · **Pending:** 7
- **Generated:** 2026-08-18T04:28:49.840Z

| Task | Status |
|------|--------|
| **T1: Абстракция ForgeConfig + автодетект языка** — `src/core/forgeConfig.ts`: интерфейс `ForgeConfig { testTemplate, command, testExt, srcExt, testDir, srcDir, refactor?, parseOutput? }`, функция `detectForgeConfig(root: string): ForgeConfig` с автодетектом по маркерам (`build.gradle` → Gradle/Java, `package.json` → TS/Node.js, `pom.xml` → Maven/Java), fallback на текущие TS-дефолты. Без зависимостей, только `fs.existsSync`. | pending |
| **T2: GradleForgeConfig** — конкретная реализация `ForgeConfig` для Java/Gradle: JUnit 5 шаблон теста (`import org.junit.jupiter.api.*`), команда `./gradlew test --tests "*{slug}*"`, расширения `.java`, парсинг вывода Gradle (ищем `> No tests found`, `BUILD SUCCESSFUL`, `FAILED`, `PASSED`). Внедрение в `src/core/forgeConfig.ts`. | pending |
| **T3: Рефакторинг tddCore.ts — загрузка конфига** — `loadTddConfig()` → вызывает `detectForgeConfig()` если нет ручного `orionTdd.json`. `TddEngine` использует поля из `ForgeConfig` вместо хардкода (testTemplate, command, testExt, srcExt, testDir, srcDir). Все существующие тесты проходят без изменений. | pending |
| **T4: Рефакторинг tddCore.refactor() — через конфиг** — `refactor()` в `TddEngine` вызывает `ForgeConfig.refactor(root)` вместо жёсткого `eslint --fix + prettier`. Для TS — eslint+prettier как было. Для Gradle — `./gradlew spotlessApply` или no-op. `forge/handler.ts:refactorAll()` аналогично. | pending |
| **T5: Поддержка .java сниппетов** — `resolveSnippet()` в `snippet.ts` ищет сниппеты по слагу с расширением из `ForgeConfig.srcExt` (`.java` для Java). `executeTask()` создаёт файлы с правильным расширением. Тест: сниппет `*.java` подхватывается, тест пишется в `src/test/java/`. | pending |
| **T6: Тесты Java/Gradle цикла** — JUnit 5 тест-шаблон, применение Java-сниппета, `./gradlew test` (если Gradle доступен, иначе скип с честным сообщением). Мокать `execAsync` для детерминизма. Проверить что все TS-тесты (867) проходят без изменений. | pending |
| **T7: Документация** — пример `orionTdd.json` для Java/Gradle в README или `docs/forge.md`. Упоминание автодетекта и как переопределить вручную. | pending |

Waiting for implementation snippets:
- `changes/forge-должен-выполнять-red/snippets/t1_абстракция_forgeconfig.ts`
- `changes/forge-должен-выполнять-red/snippets/t2_gradleforgeconfig_конкретная.ts`
- `changes/forge-должен-выполнять-red/snippets/t3_рефакторинг_tddcore.ts`
- `changes/forge-должен-выполнять-red/snippets/t4_рефакторинг_tddcore.ts`
- `changes/forge-должен-выполнять-red/snippets/t5_поддержка_java.ts`
- `changes/forge-должен-выполнять-red/snippets/t6_тесты_java.ts`
- `changes/forge-должен-выполнять-red/snippets/t7_документация_пример.ts`
