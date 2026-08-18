// ponytail: rung-2 — Gradle/Java adapter for language-agnostic shield
// ponytail: rung-4 — spawnSync, zero runtime deps

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ShieldAdapter, type GuardCommand } from "./adapter.js";

/**
 * GradleAdapter supports Java/Gradle and Maven projects.
 * All tools are called via spawnSync — no runtime dependencies.
 */
export const GradleAdapter: ShieldAdapter = {
  id: "gradle",

  detect(cwd: string): boolean {
    return (
      existsSync(join(cwd, "build.gradle")) ||
      existsSync(join(cwd, "build.gradle.kts")) ||
      existsSync(join(cwd, "pom.xml"))
    );
  },

  getLintCommand(): GuardCommand | null {
    // checkstyle is the most common Java linter; PMD is another option.
    if (existsSync("config/checkstyle/checkstyle.xml")) {
      return { cmd: "./gradlew", args: ["checkstyleMain", "2>&1"] };
    }
    // If no checkstyle config, return null (lint skip).
    return null;
  },

  getTypeCheckCommand(): GuardCommand | null {
    return { cmd: "./gradlew", args: ["compileJava", "2>&1"] };
  },

  getTestCommand(): GuardCommand | null {
    return { cmd: "./gradlew", args: ["test", "2>&1"] };
  },

  extractApi(files: string[]): string[] {
    const exports: string[] = [];
    // Java AST extractor via regex: class, interface, enum, record, @interface
    const JAVA_DECL =
      /(?:public\s+)?(?:abstract\s+|final\s+|sealed\s+)?(?:class|interface|enum|record|@interface)\s+([A-Za-z0-9_]+)/g;
    const METHOD_DECL =
      /(?:(?:public|protected|private)\s+)?(?:static\s+|abstract\s+|final\s+|default\s+)?(?:[A-Za-z_][A-Za-z0-9_<>[\],? \t]*)\s+([a-z][A-Za-z0-9_]+)\s*\(/g;
    for (const f of files) {
      try {
        const src = readFileSync(f, "utf8");
        let m: RegExpExecArray | null;
        while ((m = JAVA_DECL.exec(src))) exports.push(m[1]);
        while ((m = METHOD_DECL.exec(src))) exports.push(m[1]);
      } catch {
        // skip unreadable
      }
    }
    return exports;
  },

  getSecurityPatterns() {
    return [
      { re: /Runtime\s*\.\s*getRuntime\s*\(/, label: "Runtime.getRuntime()" },
      { re: /\bProcessBuilder\b/, label: "ProcessBuilder usage" },
      { re: /new\s+ProcessBuilder\s*\(/, label: "new ProcessBuilder()" },
      { re: /\bFile\s*\(/, label: "File I/O" },
      { re: /\bFileInputStream\b/, label: "FileInputStream" },
      { re: /\bFileOutputStream\b/, label: "FileOutputStream" },
      {
        re: /\bObjectInputStream\b/,
        label: "ObjectInputStream (deserialization)",
      },
      { re: /\bMethod\s*\.\s*invoke\b/, label: "reflective Method.invoke()" },
      {
        re: /@SuppressWarnings\b/,
        label: "@SuppressWarnings (may hide issues)",
      },
      { re: /\bSystem\s*\.\s*exit\b/, label: "System.exit()" },
    ];
  },

  fileMetrics(file: string): { loc: number; imports: number } {
    try {
      const src = readFileSync(file, "utf8");
      const lines = src.split(/\r?\n/);
      const codeLines = lines.filter(
        (l) =>
          l.trim().length > 0 &&
          !l.trim().startsWith("//") &&
          !l.trim().startsWith("*") &&
          !l.trim().startsWith("/*"),
      );
      const imports = lines.filter((l) => /^import\s+/.test(l.trim())).length;
      return { loc: codeLines.length, imports };
    } catch {
      return { loc: 0, imports: 0 };
    }
  },
};
