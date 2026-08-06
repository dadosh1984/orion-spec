import { describe, it, expect } from "vitest";
import {
  normalizePrompt,
  detectLanguage,
  assessPrompt,
  clarifyingQuestions,
  composeGoal,
} from "../src/skills/think/refine.js";

describe("prompt refinement", () => {
  it("normalizePrompt collapses whitespace and trims", () => {
    expect(normalizePrompt("  build   a   tool  ")).toBe("build a tool");
    expect(normalizePrompt("\n\n  \t x  \n")).toBe("x");
  });

  it("detects the prompt language", () => {
    expect(detectLanguage("build a calculator")).toBe("en");
    expect(detectLanguage("создай калькулятор")).toBe("ru");
    expect(detectLanguage("смесь build калькулятор")).toBe("ru");
  });

  it("assesses a clear prompt", () => {
    const a = assessPrompt("Build a CLI tool that scans git history");
    expect(a.clarity).toBe("clear");
    expect(a.missing).toEqual([]);
  });

  it("assesses a vague prompt (no action verb)", () => {
    const a = assessPrompt("калькулятор");
    expect(a.clarity).toBe("vague");
    expect(a.missing).toContain("action");
    expect(a.language).toBe("ru");
  });

  it("assesses a vague prompt (too little detail)", () => {
    const a = assessPrompt("make");
    expect(a.clarity).toBe("vague");
    expect(a.missing).toContain("action" === undefined ? "" : "detail");
    expect(a.missing).toContain("object");
  });

  it("builds clarifying questions in the prompt's language", () => {
    const ru = clarifyingQuestions(assessPrompt("калькулятор"));
    expect(ru.length).toBeGreaterThan(0);
    expect(ru[0].msg).toMatch(/сделать|делать/);

    const en = clarifyingQuestions(assessPrompt("calculator"));
    expect(en[0].msg).toMatch(/done|do/);
  });

  it("composeGoal prefers a concrete rephrase, falls back to raw", () => {
    expect(composeGoal("калькулятор", [])).toBe("калькулятор");
    expect(composeGoal("калькулятор", ["создать CLI калькулятор"])).toContain(
      "создать CLI калькулятор",
    );
  });
});
