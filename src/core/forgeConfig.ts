// ponytail: rung3 — единственная точка правки конфига forge под любой язык
// ponytail: rung5 — автодетект по маркерам, не ручная настройка
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/** Языконезависимый конфиг для RED-GREEN-REFACTOR цикла forge. */
export interface ForgeConfig {
  /** JUnit/jest/vitest шаблон теста. {{task}} → имя задачи, {{slug}} → слаг. */
  testTemplate: string;
  /** Команда запуска тестов. {{task}}, {{testFile}}, {{testDir}}, {{root}} */
  command: string;
  /** Расширение тестового файла (например .test.ts, .java) */
  testExt: string;
  /** Расширение исходного файла (например .ts, .java) */
  srcExt: string;
  /** Директория тестов (например tests, src/test/java) */
  testDir: string;
  /** Директория исходников (например src/tasks, src/main/java) */
  srcDir: string;
  /** Опциональная команда рефакторинга (lint+format). no-op если не задана */
  refactor?: (root: string) => Promise<boolean>;
  /** Парсинг вывода тестов → {passed, failure?}. no-op = stdout как есть */
  parseOutput?: (output: string) => { passed: boolean; failure?: string };
}

// ── TypeScript (текущие дефолты, v0.57) ──────────────────────────────

export const TYPESCRIPT_FORGE_CONFIG: ForgeConfig = {
  testTemplate:
    "import { describe, it, expect } from 'vitest';\n" +
    "import { {{task}} } from '../src/tasks/{{task}}';\n\n" +
    "describe('{{task}}', () => {\n" +
    "  it('works', () => {\n" +
    "    expect({{task}}()).toBeDefined();\n" +
    "  });\n" +
    "});\n",
  command: "pnpm vitest run tests/{{testFile}}",
  testExt: ".test.ts",
  srcExt: ".ts",
  testDir: "tests",
  srcDir: "src/tasks",
  refactor: async (root: string) => {
    try {
      execSync("pnpm exec eslint src/tasks --fix", { cwd: root });
      execSync('pnpm exec prettier --write "src/tasks/**/*.ts"', {
        cwd: root,
      });
      return true;
    } catch {
      return false;
    }
  },
};

// ── Gradle / Java ────────────────────────────────────────────────────

export const GRADLE_FORGE_CONFIG: ForgeConfig = {
  testTemplate:
    "import org.junit.jupiter.api.*;\n" +
    "import static org.junit.jupiter.api.Assertions.*;\n\n" +
    "class {{task}}Test {\n" +
    "    @Test\n" +
    "    void test{{task}}() {\n" +
    "        assertNotNull(new {{task}}());\n" +
    "    }\n" +
    "}\n",
  command: 'cd {{root}} && ./gradlew test --tests "*{{task}}*" 2>&1',
  testExt: ".java",
  srcExt: ".java",
  testDir: "src/test/java",
  srcDir: "src/main/java",
  refactor: async (root: string) => {
    try {
      execSync(`cd "${root}" && ./gradlew spotlessApply 2>&1`, {
        shell: true,
        timeout: 60_000,
        stdio: "ignore",
      } as any);
      return true;
    } catch {
      return true;
    }
  },
  parseOutput: (output: string) => {
    if (/BUILD FAILED/i.test(output)) {
      const failLine =
        output
          .split("\n")
          .find((l) => /FAILED|expected|assert|AssertionError/i.test(l))
          ?.trim() ?? "BUILD FAILED (see full output)";
      return { passed: false, failure: failLine };
    }
    if (/BUILD SUCCESSFUL/i.test(output)) return { passed: true };
    return { passed: false, failure: "BUILD did not complete" };
  },
};

// ── Автодетект ──────────────────────────────────────────────────────

/**
 * Определить язык проекта по маркерам в корне.
 * Порядок важен: build.gradle проверяется раньше package.json для
 * совместимости (Gradle + JS плагин).
 */
export function detectLanguage(root: string): "typescript" | "gradle" {
  if (
    existsSync(join(root, "build.gradle")) ||
    existsSync(join(root, "build.gradle.kts"))
  )
    return "gradle";
  if (existsSync(join(root, "pom.xml"))) return "gradle";
  return "typescript"; // fallback
}

/** Получить ForgeConfig по автодетекту языка. */
export function detectForgeConfig(root: string = process.cwd()): ForgeConfig {
  switch (detectLanguage(root)) {
    case "gradle":
      return GRADLE_FORGE_CONFIG;
    case "typescript":
    default:
      return TYPESCRIPT_FORGE_CONFIG;
  }
}
