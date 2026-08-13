import { describe, it, expect } from "vitest";
import { renderTasksBody, deriveTasks, type DerivedTask } from "../src/skills/draft/handler.js";
import { routeRequest } from "../src/core/router.js";

function tasks(...texts: string[]): DerivedTask[] {
  return texts.map((text) => ({ text, mark: "fact" as const }));
}

describe("renderTasksBody (v0.51 tree decomposition)", () => {
  it("depth<2 returns flat checklist (backward compatible)", () => {
    const t = tasks("a", "b", "c");
    expect(renderTasksBody(t, 0, "x")).toBe("- [ ] [fact] a\n- [ ] [fact] b\n- [ ] [fact] c");
    expect(renderTasksBody(t, 1, "x")).toBe("- [ ] [fact] a\n- [ ] [fact] b\n- [ ] [fact] c");
  });

  it("depth 2 groups under two big-step headings", () => {
    const t = tasks("a", "b", "c", "d");
    const body = renderTasksBody(t, 2, "proj");
    expect(body).toContain("## ✦ proj — big step 1");
    expect(body).toContain("## ✦ proj — big step 2");
    expect(body).toContain("- [ ] [fact] a");
  });

  it("depth 3 adds two medium groups per big step", () => {
    const t = tasks("a", "b", "c", "d", "e", "f");
    const body = renderTasksBody(t, 3, "proj");
    expect(body).toContain("## ✦ proj — big step 1");
    expect(body).toContain("## ✦ proj — big step 2");
    expect(body).toMatch(/### proj — big step 1 · medium 1/);
    expect(body).toMatch(/### proj — big step 1 · medium 2/);
    expect(body).toMatch(/### proj — big step 2 · medium 1/);
  });

  it("every leaf remains a parseable forge checkbox", () => {
    const body = renderTasksBody(tasks("a", "b", "c", "d"), 2, "p");
    for (const line of body.split("\n")) {
      if (line.trim().startsWith("-")) {
        expect(line.trim()).toMatch(/^- \[ \] \[fact\]/);
      }
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
    expect(body).toContain("## ✦ flag-cli — big step 1");
    expect(body).toContain("## ✦ flag-cli — big step 2");
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
