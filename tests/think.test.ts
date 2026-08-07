import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { think, slugify, shortTitle, QUESTIONS } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-think-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("think skill", () => {
  it("asks the guided questions and builds a Proposal", async () => {
    const asked: string[] = [];
    const answers = ["node", "small", "10min"];
    const ask = async (msg: string) => {
      asked.push(msg);
      return answers.shift() ?? "";
    };
    const proposal = await think(
      "Build a CSV to JSON converter",
      { noCache: true },
      ask,
    );

    expect(asked.length).toBe(QUESTIONS.length);
    expect(proposal.title).toBe("csv-json-converter");
    expect(proposal.goal).toBe("Build a CSV to JSON converter");
    expect(proposal.platform).toBe("node");
    expect(proposal.constraints).toBe("small");
    expect(proposal.budget).toBe("10min");
  });

  it("uses the prompt as the goal when questions are skipped", async () => {
    const proposal = await think("my idea", { noCache: true }, async () => "");
    expect(proposal.goal).toBe("my idea");
    expect(proposal.platform).toBe("");
  });

  it("persists proposal.json into changes/<title>/", async () => {
    const proposal = await think("my idea", { noCache: true }, async () => "");
    expect(existsSync(join("changes", proposal.title, "proposal.json"))).toBe(
      true,
    );
  });

  it("slugify produces safe identifiers", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  A  B  ")).toBe("a-b");
    expect(slugify("!!!")).toBe("untitled");
  });

  it("shortTitle keeps 3-4 significant words and drops verbs/fillers", () => {
    // Full 64-char slug truncated before; now the meaningful core only.
    expect(
      shortTitle(
        "Fix the broken test coverage gate in orion-spec: v8 coverage reports 0% for every src file on Node v24.18.0",
      ),
    ).toBe("broken-test-coverage-gate");
    expect(
      shortTitle(
        "Fix two real bugs in the reuse stage of Orion's own YAGNI scale tool",
      ),
    ).toBe("two-real-bugs-reuse");
    expect(shortTitle("Build a CSV to JSON converter")).toBe(
      "csv-json-converter",
    );
    expect(shortTitle("a web dashboard")).toBe("web-dashboard");
    expect(shortTitle("improve the logical sequence of decisions")).toBe(
      "logical-sequence-decisions",
    );
  });

  it("shortTitle falls back to the full slug when too little remains", () => {
    // One significant word → keep the historical slug (collision-safe).
    expect(shortTitle("build a calculator")).toBe("build-a-calculator");
    // Cyrillic-only prompt: slugify drops it to "cli" (historic title).
    expect(shortTitle("сделай CLI калькулятор с историей операций")).toBe(
      "cli",
    );
  });

  it("returns the existing proposal unchanged for a repeated idea", async () => {
    const first = await think("same idea", { noCache: true }, async () => "");
    expect(first.platform).toBe("");

    // A second think with the same goal must not clobber the first one
    // and must not re-ask the guided questions.
    let asked = 0;
    const again = await think("same idea", { noCache: true }, async () => {
      asked++;
      return "node";
    });
    expect(again).toStrictEqual(first);
    expect(asked).toBe(0);
    expect(again.platform).toBe("");
  });

  it("auto-suffixes the title when a different idea collides (non-TTY)", async () => {
    await think("Build a tool", { noCache: true }, async () => "");
    // Same slugified title, different goal → non-TTY context auto-suffixes.
    const second = await think(
      "build a tool!",
      { noCache: true },
      async () => "",
    );
    expect(second.title).toBe("build-a-tool-2");
    expect(second.goal).toBe("build a tool!");

    const third = await think(
      "BUILD A TOOL",
      { noCache: true },
      async () => "",
    );
    expect(third.title).toBe("build-a-tool-3");
  });

  it("asks clarifying questions for a vague prompt and refines the goal", async () => {
    const asked: string[] = [];
    const answers = [
      "создать CLI калькулятор с историей",
      "калькулятор с историей операций в консоли",
      "node",
      "small",
      "10min",
    ];
    const ask = async (msg: string) => {
      asked.push(msg);
      return answers.shift() ?? "";
    };
    const proposal = await think("калькулятор", { noCache: true }, ask);

    // Two clarifying questions (action + detail), then the guided ones.
    expect(asked.length).toBe(QUESTIONS.length + 2);
    expect(asked[0]).toMatch(/сделать|делать/);
    expect(proposal.goal).toContain("создать CLI калькулятор с историей");
    expect(proposal.clarity).toBe("clear");
    expect(proposal.language).toBe("ru");
    expect(proposal.platform).toBe("node");
  });

  it("keeps the raw goal when clarification answers are empty", async () => {
    const proposal = await think(
      "калькулятор",
      { noCache: true },
      async () => "",
    );
    expect(proposal.goal).toBe("калькулятор");
    expect(proposal.clarity).toBe("vague");
  });
});
