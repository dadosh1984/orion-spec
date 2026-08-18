// ponytail: rung3 — тесты автодетекта и Gradle-конфига forge
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectLanguage,
  detectForgeConfig,
  GRADLE_FORGE_CONFIG,
  TYPESCRIPT_FORGE_CONFIG,
} from "../src/core/forgeConfig.js";

describe("forgeConfig", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(
      tmpdir(),
      `forge-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("detectLanguage", () => {
    it("detects Gradle by build.gradle", () => {
      writeFileSync(join(tmp, "build.gradle"), "");
      expect(detectLanguage(tmp)).toBe("gradle");
    });

    it("detects Gradle by build.gradle.kts", () => {
      writeFileSync(join(tmp, "build.gradle.kts"), "");
      expect(detectLanguage(tmp)).toBe("gradle");
    });

    it("detects Gradle by pom.xml", () => {
      writeFileSync(join(tmp, "pom.xml"), "");
      expect(detectLanguage(tmp)).toBe("gradle");
    });

    it("falls back to TypeScript with no markers", () => {
      expect(detectLanguage(tmp)).toBe("typescript");
    });

    it("falls back to TypeScript with package.json only", () => {
      writeFileSync(join(tmp, "package.json"), "{}");
      expect(detectLanguage(tmp)).toBe("typescript");
    });
  });

  describe("detectForgeConfig", () => {
    it("returns Gradle config for Gradle project", () => {
      const dir = join(tmp, "gradle-project");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "build.gradle"), "");
      const cfg = detectForgeConfig(dir);
      expect(cfg.testExt).toBe(".java");
      expect(cfg.srcExt).toBe(".java");
      expect(cfg.testDir).toBe("src/test/java");
      expect(cfg.srcDir).toBe("src/main/java");
    });

    it("returns TypeScript config for JS project", () => {
      writeFileSync(join(tmp, "package.json"), "{}");
      const cfg = detectForgeConfig(tmp);
      expect(cfg.testExt).toBe(".test.ts");
      expect(cfg.srcExt).toBe(".ts");
    });

    it("returns TypeScript config for empty project (fallback)", () => {
      const cfg = detectForgeConfig(tmp);
      expect(cfg.testExt).toBe(".test.ts");
    });

    it("uses process.cwd() when root omitted", () => {
      const cfg = detectForgeConfig();
      // В корне Orion-проекта есть package.json → TypeScript
      expect(cfg.srcExt).toBe(".ts");
    });
  });

  describe("GRADLE_FORGE_CONFIG", () => {
    it("has JUnit 5 template", () => {
      const tmpl = GRADLE_FORGE_CONFIG.testTemplate;
      expect(tmpl).toContain("org.junit.jupiter.api");
      expect(tmpl).toContain("assertNotNull");
      expect(tmpl).toContain("{{task}}");
    });

    it("has gradle command with task placeholder", () => {
      expect(GRADLE_FORGE_CONFIG.command).toContain("./gradlew test");
      expect(GRADLE_FORGE_CONFIG.command).toContain("{{task}}");
    });

    it("parseOutput detects SUCCESS", () => {
      const r = GRADLE_FORGE_CONFIG.parseOutput!("BUILD SUCCESSFUL in 2s");
      expect(r.passed).toBe(true);
    });

    it("parseOutput detects FAILED", () => {
      const r =
        GRADLE_FORGE_CONFIG.parseOutput!("BUILD FAILED\n  expected <1> but was <2>");
      expect(r.passed).toBe(false);
      expect(r.failure).toContain("FAILED");
    });

    it("parseOutput detects assertion error", () => {
      const out =
        "FooTest > testFoo FAILED\n    java.lang.AssertionError: expected [true] but was [false]";
      const r = GRADLE_FORGE_CONFIG.parseOutput!(out);
      expect(r.passed).toBe(false);
    });
  });

  describe("TYPESCRIPT_FORGE_CONFIG", () => {
    it("has vitest template", () => {
      expect(TYPESCRIPT_FORGE_CONFIG.testTemplate).toContain("vitest");
    });

    it("has pnpm vitest command", () => {
      expect(TYPESCRIPT_FORGE_CONFIG.command).toContain("pnpm vitest run");
    });
  });
});
