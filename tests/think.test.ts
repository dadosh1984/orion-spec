import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { think, slugify, QUESTIONS } from "../src/skills/think/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-think-"));
  process.chdir(dir);
});

afterEach(() => {
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
    expect(proposal.title).toBe("build-a-csv-to-json-converter");
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
});
