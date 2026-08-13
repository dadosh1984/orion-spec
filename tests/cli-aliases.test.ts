import { describe, it, expect } from "vitest";
import { DEPRECATED_ALIASES } from "../src/cli/parse.js";

describe("DEPRECATED_ALIASES (v0.51 deprecation map)", () => {
  it("is a non-empty frozen object", () => {
    expect(Object.keys(DEPRECATED_ALIASES).length).toBeGreaterThan(15);
    expect(Object.isFrozen(DEPRECATED_ALIASES)).toBe(true);
  });

  it("maps 'plan' (the only fully-deprecated pipeline alias) to 'new'", () => {
    // think/draft/forge/shield/verify/out/tasks/next/pay-debt/resume/init
    // are NOT in DEPRECATED_ALIASES because their legacy switch cases
    // still work — users get the real behaviour, just no warning.
    expect(DEPRECATED_ALIASES.plan).toBe("new");
  });

  it("maps every list/inspect command to 'ls'", () => {
    for (const old of [
      "list",
      "status",
      "compare",
      "assumptions",
      "stats",
      "self-audit",
      "track",
      "history",
    ]) {
      expect(DEPRECATED_ALIASES[old], `list alias '${old}'`).toBe("ls");
    }
  });

  it("'profile' is NOT in DEPRECATED_ALIASES (legacy case still works)", () => {
    expect(DEPRECATED_ALIASES.profile).toBeUndefined();
  });

  it("'lessons' is NOT in DEPRECATED_ALIASES (legacy case still works)", () => {
    expect(DEPRECATED_ALIASES.lessons).toBeUndefined();
  });

  it("maps health/maintenance commands to 'doctor'", () => {
    for (const old of ["config", "clean", "backup", "restore", "env"]) {
      expect(DEPRECATED_ALIASES[old], `doctor alias '${old}'`).toBe("doctor");
    }
  });

  it("'mcp' is NOT in DEPRECATED_ALIASES (legacy case still works directly)", () => {
    expect(DEPRECATED_ALIASES.mcp).toBeUndefined();
  });

  it("'tdd' is NOT in DEPRECATED_ALIASES (legacy case still works directly)", () => {
    expect(DEPRECATED_ALIASES.tdd).toBeUndefined();
  });

  it("marks removed top-level commands with __removed__", () => {
    expect(DEPRECATED_ALIASES.shell).toBe("__removed__");
    expect(DEPRECATED_ALIASES.completion).toBe("__removed__");
  });

  it("marks hidden debug commands with __hidden__", () => {
    expect(DEPRECATED_ALIASES.route).toBe("__hidden__");
  });

  it("does not collide with v0.51 canonical command names", () => {
    const canonical = new Set([
      "new",
      "ls",
      "change",
      "run",
      "scale",
      "doctor",
      "serve",
      "plugin",
    ]);
    for (const [old, target] of Object.entries(DEPRECATED_ALIASES)) {
      if (target.startsWith("__")) continue; // __removed__/__hidden__ sentinels
      expect(canonical.has(target), `target '${target}' for '${old}'`).toBe(
        true,
      );
    }
  });

  it("does not map a canonical name to itself", () => {
    const canonical = new Set([
      "new",
      "ls",
      "change",
      "run",
      "scale",
      "doctor",
      "serve",
      "plugin",
    ]);
    for (const [old, target] of Object.entries(DEPRECATED_ALIASES)) {
      if (canonical.has(old)) {
        throw new Error(
          `Canonical name '${old}' appears as a deprecated alias key`,
        );
      }
      if (target === old) {
        throw new Error(`Alias '${old}' maps to itself`);
      }
    }
  });
});

describe("CLI registry (v0.51)", () => {
  it("exports an empty ORION_REGISTRY until commands are registered", async () => {
    const { ORION_REGISTRY } = await import("../src/cli/registry.js");
    // Placeholders register nothing yet (T1 was the skeleton only).
    expect(ORION_REGISTRY).toBeInstanceOf(Map);
    expect(ORION_REGISTRY.size).toBe(0);
  });

  it("registerCommand adds entries and canonicalize resolves aliases", async () => {
    const {
      ORION_REGISTRY,
      registerCommand,
      canonicalize,
    } = await import("../src/cli/registry.js");
    const before = ORION_REGISTRY.size;
    registerCommand({
      name: "__test__",
      description: "test",
      handler: () => 0,
      aliases: ["__test_alias__"],
    });
    expect(ORION_REGISTRY.size).toBe(before + 1);
    expect(canonicalize("__test_alias__")).toBe("__test__");
    expect(canonicalize("__unknown__")).toBe("__unknown__");
    // cleanup
    ORION_REGISTRY.delete("__test__");
  });

  it("registerCommand throws on duplicate name", async () => {
    const { ORION_REGISTRY, registerCommand } = await import(
      "../src/cli/registry.js"
    );
    registerCommand({
      name: "__dup__",
      description: "first",
      handler: () => 0,
    });
    expect(() =>
      registerCommand({
        name: "__dup__",
        description: "second",
        handler: () => 0,
      }),
    ).toThrow(/Duplicate command name/);
    ORION_REGISTRY.delete("__dup__");
  });
});
