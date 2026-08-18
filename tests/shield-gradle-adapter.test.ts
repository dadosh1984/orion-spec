// ponytail: rung-2 — unit tests for GradleAdapter
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GradleAdapter } from "../src/core/shield/gradle.js";
import {
  registerAdapter,
  clearAdapters,
  detectAdapter,
} from "../src/core/shield/adapter.js";

describe("GradleAdapter", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = join(
      tmpdir(),
      `gradle-adapter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmp, { recursive: true });
    clearAdapters();
    registerAdapter(GradleAdapter);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  describe("detect", () => {
    it("detects build.gradle", () => {
      writeFileSync(join(tmp, "build.gradle"), "");
      expect(GradleAdapter.detect(tmp)).toBe(true);
    });

    it("detects build.gradle.kts", () => {
      writeFileSync(join(tmp, "build.gradle.kts"), "");
      expect(GradleAdapter.detect(tmp)).toBe(true);
    });

    it("detects pom.xml (Maven)", () => {
      writeFileSync(join(tmp, "pom.xml"), "");
      expect(GradleAdapter.detect(tmp)).toBe(true);
    });

    it("returns false for empty dir", () => {
      expect(GradleAdapter.detect(tmp)).toBe(false);
    });
  });

  describe("commands", () => {
    it("getLintCommand returns null when no checkstyle config", () => {
      const cmd = GradleAdapter.getLintCommand();
      expect(cmd).toBeNull();
    });

    it("getTypeCheckCommand returns compileJava", () => {
      const cmd = GradleAdapter.getTypeCheckCommand()!;
      expect(cmd.cmd).toBe("./gradlew");
      expect(cmd.args).toContain("compileJava");
    });

    it("getTestCommand returns test", () => {
      const cmd = GradleAdapter.getTestCommand()!;
      expect(cmd.cmd).toBe("./gradlew");
      expect(cmd.args).toContain("test");
    });
  });

  describe("extractApi", () => {
    it("extracts public class names", () => {
      const r = GradleAdapter.extractApi([
        "/fake/Calculator.java",
      ]);
      // No real file → empty
      expect(r).toEqual([]);
    });

    it("extracts from Java source text via temp file", () => {
      const f = join(tmp, "Calculator.java");
      writeFileSync(
        f,
        "package com.example;\n" +
        "public class Calculator {\n" +
        "    public int add(int a, int b) { return a + b; }\n" +
        "}\n",
      );
      const r = GradleAdapter.extractApi([f]);
      expect(r).toContain("Calculator");
      expect(r).toContain("add");
    });

    it("extracts interface and enum names", () => {
      const f = join(tmp, "Shape.java");
      writeFileSync(
        f,
        "public interface Shape {\n" +
        "    double area();\n" +
        "}\n" +
        "enum Color { RED, GREEN, BLUE }\n",
      );
      const r = GradleAdapter.extractApi([f]);
      expect(r).toContain("Shape");
      expect(r).toContain("area");
      expect(r).toContain("Color");
    });
  });

  describe("security patterns", () => {
    it("includes Runtime.getRuntime", () => {
      const patterns = GradleAdapter.getSecurityPatterns();
      expect(patterns.some((p) => p.label === "Runtime.getRuntime()")).toBe(
        true,
      );
    });

    it("includes ProcessBuilder", () => {
      const patterns = GradleAdapter.getSecurityPatterns();
      expect(patterns.some((p) => p.label === "ProcessBuilder usage")).toBe(
        true,
      );
    });

    it("includes File I/O", () => {
      const patterns = GradleAdapter.getSecurityPatterns();
      expect(patterns.some((p) => p.label === "File I/O")).toBe(true);
    });
  });

  describe("fileMetrics", () => {
    it("counts LOC and imports", () => {
      const f = join(tmp, "Foo.java");
      writeFileSync(
        f,
        "import java.util.List;\n" +
        "import java.io.File;\n" +
        "public class Foo {\n" +
        "    // comment\n" +
        "    public void run() {}\n" +
        "}\n",
      );
      const m = GradleAdapter.fileMetrics(f);
      expect(m.loc).toBeGreaterThanOrEqual(3); // class, method, blank lines excluded
      expect(m.imports).toBe(2);
    });
  });

  describe("integration: detectAdapter", () => {
    it("returns GradleAdapter for Gradle project", () => {
      writeFileSync(join(tmp, "build.gradle"), "");
      const a = detectAdapter(tmp);
      expect(a?.id).toBe("gradle");
    });

    it("returns null for empty project", () => {
      const a = detectAdapter(tmp);
      expect(a).toBeNull();
    });
  });
});
