import { describe, it, expect } from "vitest";
import { renderTasksBody, deriveTasks, type DerivedTask } from "../src/skills/draft/handler.js";
import { routeRequest } from "../src/core/router.js";

function tasks(...texts: string[]): DerivedTask[] {
  return texts.map((text) => ({ text, mark: "fact" as const }));
}

describe("renderTasksBody (v0.51 atomic tree decomposition)", () => {
  it("depth<2 returns flat checklist (backward compatible)", () => {
    const t = tasks("a", "b", "c");
    expect(renderTasksBody(t, 0, "x")).toBe("- [ ] [fact] a\n- [ ] [fact] b\n- [ ] [fact] c");
    expect(renderTasksBody(t, 1, "x")).toBe("- [ ] [fact] a\n- [ ] [fact] b\n- [ ] [fact] c");
  });

  it("depth>=2 emits a ## big-step heading and unindented leaves", () => {
    const t = tasks("a", "b", "c");
    const body = renderTasksBody(t, 2, "proj");
    expect(body).toContain("## ✦ proj — big step");
    expect(body).toContain("- [ ] [fact] a");
  });

  it("every leaf remains a parseable forge checkbox (no indentation)", () => {
    const body = renderTasksBody(tasks("a", "b", "c", "d"), 2, "p");
    for (const line of body.split("\n")) {
      if (line.startsWith("- [ ]")) expect(line).toMatch(/^- \[ \] \[fact\]/);
    }
  });

  it("deriveTasks + renderTasksBody compose for a medium goal", () => {
    const proposal = {
      title: "flag-cli",
      goal: "add a --verbose flag to the CLI and update the README docs",
      platform: "cli",
      depth: 2,
    } as never;
    const derived = deriveTasks(proposal);
    const body = renderTasksBody(derived, 2, "flag-cli");
    expect(body).toContain("## ✦ flag-cli — big step");
  });

  it("maintenance RED→fix→verify plans bypass atomic re-split", () => {
    const maint = tasks(
      "Reproduce the failure: write a test that fails (RED)",
      "Implement the fix without changing the API",
    );
    const body = renderTasksBody(maint, 2, "fix-gate");
    // Purpose-built plan is preserved flat, not decomposed.
    expect(body).not.toContain("## ✦");
    expect(body).toContain("- [ ] [fact] Implement the fix without changing the API");
  });
});

describe("router abstract gate (v0.51 eat-an-elephant)", () => {
  it("routes abstract questions to DIRECT_AI, never through forge", () => {
    for (const p of [
      "what is a closure in javascript?",
      "объясни как работает async/await",
      "compare REST vs GraphQL",
    ]) {
      const r = routeRequest(p);
      expect(r.action).toBe("DIRECT_AI");
      expect(r.reason.toLowerCase()).toContain("abstract");
    }
  });

  it("still sends executable work through the normal pipeline", () => {
    const r = routeRequest("backup the old temp files and delete duplicates");
    expect(r.action).toBe("CREATE_NEW_SKILL");
  });
});
