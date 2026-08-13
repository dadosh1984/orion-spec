import { describe, it, expect } from "vitest";
import {
  isAtomicStep,
  splitStep,
  atomicTree,
  type AtomicInput,
} from "../src/skills/draft/atomic.js";

const F = (t: string): AtomicInput => ({ text: t, mark: "fact" });

describe("atomic step criteria (v0.51)", () => {
  it("a single action is atomic", () => {
    expect(isAtomicStep("Build the CLI entry point")).toBe(true);
    expect(isAtomicStep("implement the --verbose flag")).toBe(true);
    expect(isAtomicStep("Cover the core capability with tests")).toBe(true);
    expect(isAtomicStep("Document usage in README")).toBe(true);
  });

  it("compound intent is not atomic", () => {
    expect(isAtomicStep("add a flag and update the docs and write a test")).toBe(false);
    expect(isAtomicStep("fix the parser and if it fails roll back")).toBe(false);
  });

  it("Russian single action is atomic, compound is not", () => {
    expect(isAtomicStep("добавь флаг verbose")).toBe(true);
    expect(isAtomicStep("добавь флаг и обнови документацию и напиши тест")).toBe(false);
  });
});

describe("splitStep (v0.51)", () => {
  it("splits at a coordinating conjunction", () => {
    const parts = splitStep("implement the flag and update the readme");
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("returns the whole text when nothing to split on", () => {
    expect(splitStep("Build the CLI entry point")).toEqual([
      "Build the CLI entry point",
    ]);
  });
});

describe("atomicTree (v0.51)", () => {
  it("depth<2 returns the input verbatim (flat compat)", () => {
    const leaves = atomicTree([F("a"), F("b")], { depth: 1 });
    expect(leaves.map((l) => l.text)).toEqual(["a", "b"]);
    expect(leaves.every((l) => l.depth === 0)).toBe(true);
  });

  it("splits compound steps into atomic leaves", () => {
    const leaves = atomicTree([F("fix the parser and add a test")], { depth: 3 });
    expect(leaves.length).toBeGreaterThan(1);
    expect(leaves.every((l) => isAtomicStep(l.text) || l.mark === "ask-user")).toBe(true);
  });

  it("never produces a leaf deeper than maxDepth (deadlock guard)", () => {
    const leaves = atomicTree(
      [F("do A and then B and then C and then D and then E and then F and then G")],
      { depth: 3, maxDepth: 4 },
    );
    for (const l of leaves) expect(l.depth).toBeLessThanOrEqual(4);
  });

  it("marks residual ambiguity as [ask-user] at the ceiling", () => {
    const leaves = atomicTree(
      [F("build A and then do B and then C and then D and then E and then F and then G and then H")],
      { depth: 3, maxDepth: 3 },
    );
    expect(leaves.some((l) => l.mark === "ask-user")).toBe(true);
  });

  it("the depth of a split leaf is greater than its parent's", () => {
    const leaves = atomicTree([F("build A and write the tests")], { depth: 2 });
    const deep = leaves.find((l) => l.depth > 1);
    expect(deep).toBeDefined();
  });

  it("every leaf satisfies the forge parseable invariant", () => {
    const leaves = atomicTree(
      [F("implement the flag and update the docs and write a test")],
      { depth: 3 },
    );
    for (const l of leaves) {
      // Leaves tokenise to a single `- [ ] [mark] text` line.
      expect(`- [ ] [${l.mark}] ${l.text}`).toMatch(
        /^- \[ \] \[(fact|assumption|ask-user)\] .+/,
      );
    }
  });
});
