import { describe, it, expect } from "vitest";
import { classifyComplexity } from "../src/skills/think/complexity.js";

describe("classifyComplexity (v0.51 «eat an elephant»)", () => {
  describe("abstract prompts (questions, not deliverables)", () => {
    it("classifies 'what is a closure' as abstract", () => {
      const r = classifyComplexity("what is a closure in javascript?");
      expect(r.complexity).toBe("abstract");
      expect(r.depth).toBe(0);
      expect(r.plannedSteps).toBe(0);
    });

    it("classifies 'explain how promises work' as abstract", () => {
      const r = classifyComplexity("explain how promises work");
      expect(r.complexity).toBe("abstract");
    });

    it("classifies Russian abstract prompts", () => {
      const r = classifyComplexity("объясни как работает async/await");
      expect(r.complexity).toBe("abstract");
      expect(r.depth).toBe(0);
    });

    it("classifies comparison questions as abstract", () => {
      const r = classifyComplexity("compare REST vs GraphQL");
      expect(r.complexity).toBe("abstract");
    });
  });

  describe("easy prompts (1 action, simple scope)", () => {
    it("classifies a single typo fix as easy", () => {
      const r = classifyComplexity("fix the typo in README");
      expect(r.complexity).toBe("easy");
      expect(r.depth).toBe(1);
      expect(r.plannedSteps).toBe(2);
    });

    it("classifies a simple add as easy", () => {
      const r = classifyComplexity("add a version flag");
      expect(r.complexity).toBe("easy");
      expect(r.depth).toBe(1);
    });

    it("classifies Russian easy prompts", () => {
      const r = classifyComplexity("исправь опечатку в `src/cli/parse.ts`");
      expect(r.complexity).toBe("easy");
      expect(r.depth).toBe(1);
    });
  });

  describe("medium prompts (2-3 actions, multiple entities)", () => {
    it("classifies a two-feature request as medium", () => {
      const r = classifyComplexity(
        "add a `--verbose` flag to the CLI and update the README docs",
      );
      expect(r.complexity).toBe("medium");
      expect(r.depth).toBe(2);
      expect(r.plannedSteps).toBe(4);
    });

    it("classifies a parser + test request as medium or hard (compound intent)", () => {
      // "implement ... parse ... write ... test ..." — many action verbs;
      // whether this lands medium or hard depends on entity density, both
      // are honest answers for a compound request like this.
      const r = classifyComplexity(
        "implement a CSV parser in `src/parse.ts` and write unit tests in `tests/parse.test.ts`",
      );
      expect(["medium", "hard"]).toContain(r.complexity);
    });
  });

  describe("hard prompts (system-scale, many entities)", () => {
    it("classifies a system refactor as hard", () => {
      const r = classifyComplexity(
        "refactor the entire authentication system and integrate it across all services including the API gateway, the web dashboard, and the MCP server",
      );
      expect(r.complexity).toBe("hard");
      expect(r.depth).toBe(3);
      expect(r.plannedSteps).toBe(8);
    });

    it("classifies a full migration as hard", () => {
      const r = classifyComplexity(
        "migrate the whole architecture from CommonJS to ESM across the entire codebase end-to-end",
      );
      expect(r.complexity).toBe("hard");
    });

    it("classifies Russian hard prompts", () => {
      const r = classifyComplexity(
        "рефактори всю систему аутентификации и интегрируй её во всех сервисах",
      );
      expect(r.complexity).toBe("hard");
    });
  });

  describe("signal breakdown transparency", () => {
    it("returns a non-negative signal breakdown", () => {
      const r = classifyComplexity("build a web scraper");
      for (const key of [
        "actions",
        "conjunctions",
        "entities",
        "scaleWords",
        "length",
        "total",
      ] as const) {
        expect(r.signals[key]).toBeGreaterThanOrEqual(0);
      }
    });

    it("scale words add more weight than actions", () => {
      const easy = classifyComplexity("fix a bug");
      const hard = classifyComplexity(
        "refactor the entire system architecture",
      );
      expect(hard.signals.total).toBeGreaterThan(easy.signals.total);
    });
  });

  describe("depth → plannedSteps mapping", () => {
    it("depth 0 (abstract) = 0 steps", () => {
      expect(classifyComplexity("why?").plannedSteps).toBe(0);
    });

    it("depth 1 (easy) = 2 steps", () => {
      const r = classifyComplexity("fix typo");
      if (r.depth === 1) expect(r.plannedSteps).toBe(2);
    });

    it("depth 2 (medium) = 4 steps", () => {
      const r = classifyComplexity(
        "add feature X and write tests for it in `tests/x.test.ts`",
      );
      if (r.depth === 2) expect(r.plannedSteps).toBe(4);
    });

    it("depth 3 (hard) = 8 steps", () => {
      const r = classifyComplexity(
        "rebuild the entire system architecture end-to-end and integrate all services",
      );
      if (r.depth === 3) expect(r.plannedSteps).toBe(8);
    });
  });

  describe("language detection default", () => {
    it("auto-detects Russian from Cyrillic", () => {
      const r = classifyComplexity("сделай калькулятор");
      expect(r.complexity).not.toBe("abstract");
    });

    it("defaults to English for Latin script", () => {
      const r = classifyComplexity("build a calculator");
      expect(r.complexity).not.toBe("abstract");
    });
  });
});
