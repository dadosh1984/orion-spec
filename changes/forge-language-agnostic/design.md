# Дизайн — forge-language-agnostic

## Обзор

Forge (RED-GREEN-REFACTOR) сейчас завязан на TypeScript/Node.js экосистему:
- `tddCore.ts` — жёсткие дефолты vitest, eslint, prettier, `.ts`
- `forge/handler.ts` — `refactorAll()` — eslint/prettier, сниппеты `.ts`

Нужно: абстрагировать конфигурацию forge, добавить автодетект языка по маркерам проекта, реализовать GradleAdapter для Java/Gradle. Не сломать существующие TS-проекты.

## Модули

- `src/core/forgeConfig.ts` — **новый**: `ForgeConfig` интерфейс + `detectForgeConfig()` (автодетект) + `GradleForgeConfig` (Java) + `TypeScriptForgeConfig` (текущие дефолты)
- `src/core/tddCore.ts` — **изменения**: `loadTddConfig()` вызывает `detectForgeConfig()`; `TddEngine` использует поля конфига вместо хардкода; `refactor()` — через конфиг
- `src/skills/forge/handler.ts` — **изменения**: `refactorAll()` — через конфиг; `executeTask()` — расширение из конфига
- `src/skills/forge/snippet.ts` — **изменения**: поиск сниппетов с расширением из конфига
- `tests/forge-config.test.ts` — **новый**: тесты автодетекта и Gradle-конфига

## Автодетект (маркеры)

| Маркер | Язык | ForgeConfig |
|--------|------|-------------|
| `build.gradle` или `build.gradle.kts` | Java/Gradle | `GradleForgeConfig` |
| `pom.xml` | Java/Maven | `GradleForgeConfig` (единый Java) |
| `package.json` | TypeScript/Node.js | `TypeScriptForgeConfig` (текущие дефолты) |
| ничего | fallback | `TypeScriptForgeConfig` |

## GradleForgeConfig

- `testTemplate` — JUnit 5:
  ```java
  import org.junit.jupiter.api.*;
  import static org.junit.jupiter.api.Assertions.*;
  
  class {{task}}Test {
      @Test
      void test{{task}}() {
          assertNotNull(new {{task}}());
      }
  }
  ```
- `command` — `cd {{root}} && ./gradlew test --tests "*{{task}}*" 2>&1`
- `testExt` — `.java`, `srcExt` — `.java`
- `testDir` — `src/test/java`, `srcDir` — `src/main/java`
- `refactor(root)` — `./gradlew spotlessApply` (если есть) или no-op
- `parseOutput(output)` — ищет `BUILD SUCCESSFUL`/`BUILD FAILED`, `> No tests found`, `FAILED`, `PASSED`

## Верификация

- [ ] все существующие тесты проходят (`pnpm run test:coverage`)
- [ ] `tsc --noEmit` без ошибок
- [ ] автодетект: `build.gradle` → Gradle, `package.json` → TS, нет маркеров → TS
- [ ] Gradle-конфиг: шаблон JUnit 5, команда `./gradlew test`
- [ ] `TddEngine` с Gradle конфигом: создаёт `.java` файлы, команда Gradle, refactor no-op
