// === T9: Тесты адаптеров ===
// Тесты для ShieldAdapter, TypeScriptAdapter, PythonAdapter, Config
// ponytail: rung-1 — tests needed for new code

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:os" as osJoin;
import { tmpdir } from "node:os";

import {
  ShieldAdapter, GuardCommand,
  registerAdapter, getAdapters, detectAdapter, clearAdapters,
} from "../src/core/shield/adapter.js";
import { TypeScriptAdapter } from "../src/core/shield/typescript.js";
import { loadShieldConfig } from "../src/core/shield/config.js";

describe("adapter registry", () => {
  beforeEach(() => clearAdapters());

  it("registerAdapter adds to registry", () => {
    registerAdapter(TypeScriptAdapter);
    expect(getAdapters().length).toBe(1);
    expect(getAdapters()[0].id).toBe("typescript");
  });

  it("detectAdapter returns matching adapter", () => {
    registerAdapter(TypeScriptAdapter);
    const cwd = process.cwd(); // has package.json
    const a = detectAdapter(cwd);
    expect(a).not.toBeNull();
    expect(a!.id).toBe("typescript");
  });

  it("detectAdapter returns null when no adapter matches", () => {
    const cwd = "/nonexistent";
    const a = detectAdapter(cwd);
    expect(a).toBeNull();
  });

  it("registerAdapter is idempotent", () => {
    registerAdapter(TypeScriptAdapter);
    registerAdapter(TypeScriptAdapter);
    expect(getAdapters().length).toBe(1);
  });
});

describe("TypeScriptAdapter", () => {
  it("detects package.json", () => {
    expect(TypeScriptAdapter.detect(process.cwd())).toBe(true);
  });

  it("extractApi returns exported symbols", () => {
    const tmp = join(tmpdir(), `ts-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, "test.ts"), "export const foo = 1;\nexport function bar() {}\n");
    const symbols = TypeScriptAdapter.extractApi([join(tmp, "test.ts")]);
    expect(symbols).toContain("foo");
    expect(symbols).toContain("bar");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("fileMetrics counts LOC and imports", () => {
    const tmp = join(tmpdir(), `ts-metrics-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, "test.ts"), "import { a } from 'x';\nconst b = 1;\n");
    const m = TypeScriptAdapter.fileMetrics(join(tmp, "test.ts"));
    expect(m.loc).toBe(2);
    expect(m.imports).toBe(1);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("getSecurityPatterns returns non-empty array", () => {
    const patterns = TypeScriptAdapter.getSecurityPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].label).toBeTruthy();
    expect(patterns[0].re).toBeInstanceOf(RegExp);
  });
});

describe("config loader", () => {
  it("returns null when no config file", () => {
    const tmp = join(tmpdir(), `cfg-test-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    expect(loadShieldConfig(tmp)).toBeNull();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("loads valid config from .orion/shield.json", () => {
    const tmp = join(tmpdir(), `cfg-test2-${Date.now()}`);
    mkdirSync(join(tmp, ".orion"), { recursive: true });
    writeFileSync(
      join(tmp, ".orion", "shield.json"),
      JSON.stringify({ language: "python", shield: { lint: { cmd: "ruff", args: ["check", "."] } } }),
    );
    const cfg = loadShieldConfig(tmp);
    expect(cfg).not.toBeNull();
    expect(cfg!.language).toBe("python");
    expect(cfg!.shield?.lint?.cmd).toBe("ruff");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null for invalid JSON", () => {
    const tmp = join(tmpdir(), `cfg-test3-${Date.now()}`);
    mkdirSync(join(tmp, ".orion"), { recursive: true });
    writeFileSync(join(tmp, ".orion", "shield.json"), "not json");
    expect(loadShieldConfig(tmp)).toBeNull();
    rmSync(tmp, { recursive: true, force: true });
  });
});
