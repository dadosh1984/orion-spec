import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseSession,
  findPairs,
  hasError,
  signatureOf,
  learnFromSessions,
  sessionFiles,
  sessionRoleBreakdown,
} from "../src/core/sessions.js";
import { listLessons, readLessons } from "../src/core/lessons.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-sessions-"));
  process.chdir(dir);
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.jsonl");
});

afterEach(() => {
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

/** A tiny pi-style JSONL fixture. */
function piSession(): string {
  return [
    JSON.stringify({ type: "session", id: "s1" }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "toolCall", id: "c1", name: "bash", arguments: { command: "pnpm lint" } },
        ],
      },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "c1",
        toolName: "bash",
        content: [{ type: "text", text: "error: found lint problems" }],
      },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "assistant",
        content: [
          { type: "toolCall", id: "c2", name: "bash", arguments: { command: "pnpm lint --fix" } },
        ],
      },
    }),
    JSON.stringify({
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "c2",
        toolName: "bash",
        content: [{ type: "text", text: "All matched files use Prettier code style!" }],
      },
    }),
    "not-json",
    "",
  ].join("\n");
}

describe("session parsing", () => {
  it("extracts ordered actions from a pi-style session, counting invalid lines", () => {
    const { actions, records, skipped } = parseSession(piSession());
    expect(records).toBe(5);
    expect(skipped).toBe(1);
    expect(actions).toHaveLength(4);
    expect(actions[0].tool).toBe("bash");
    expect(actions[0].command).toBe("pnpm lint");
    expect(actions[1].output).toContain("error");
    expect(actions[3].output).toContain("Prettier");
  });

  it("understands generic {role, content} records", () => {
    const jsonl = [
      JSON.stringify({ role: "assistant", content: [{ type: "tool_call", name: "read", arguments: { path: "a.ts" } }] }),
      JSON.stringify({ role: "tool_result", content: "error: not found" }),
      JSON.stringify({ role: "tool_result", content: "ok" }),
    ].join("\n");
    const { actions } = parseSession(jsonl);
    expect(actions.some((a) => a.tool === "read" && a.output === "")).toBe(true);
    expect(actions.some((a) => a.output === "error: not found")).toBe(true);
  });

  it("signatureOf keeps tool + first significant tokens, drops hashes", () => {
    expect(signatureOf("bash", "pnpm test")).toBe("bash pnpm test");
    expect(signatureOf("bash", "pnpm test 9f86d081884c7d659a2f")).toBe("bash pnpm test");
    expect(signatureOf("read", "README.md")).toBe("read README.md");
    expect(signatureOf("bash", "")).toBe("bash");
  });
});

describe("error markers (RU/EN, word-bounded)", () => {
  it("detects genuine failures", () => {
    expect(hasError("Error: ENOENT no such file")).toBe(true);
    expect(hasError("Tests  2 failed")).toBe(true);
    expect(hasError("exit code 1")).toBe(true);
    expect(hasError("Traceback (most recent call last)")).toBe(true);
    expect(hasError("ошибка: не найден файл")).toBe(true);
    expect(hasError("файл не существует")).toBe(true);
  });

  it("does not false-positive on harmless words", () => {
    expect(hasError("9 failing line(s) help text")).toBe(true); // "failing" whole word is a real marker
    expect(hasError("All matched files use Prettier code style!")).toBe(false);
    expect(hasError("total 159")).toBe(false);
    expect(hasError("Found 0 errors")).toBe(false); // "errors" needs word boundary — "0 errors" has none
  });
});

describe("pair detection", () => {
  it("finds failed → succeeded pairs for the same signature", () => {
    const { actions } = parseSession(piSession());
    const pairs = findPairs(actions);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].signature).toContain("pnpm lint");
    expect(pairs[0].error).toContain("found lint problems");
    expect(pairs[0].corrected).toBe("pnpm lint --fix");
    expect(pairs[0].count).toBe(1);
  });

  it("counts recurring failures of the same pattern", () => {
    const { actions } = parseSession(
      [
        ...piSession().split("\n").slice(1, 5),
        ...piSession().split("\n").slice(1, 5),
      ].join("\n"),
    );
    const pairs = findPairs(actions);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].count).toBe(2);
  });

  it("ignores failures with no later success (honest: not a learned lesson)", () => {
    const { actions } = parseSession(
      JSON.stringify({
        type: "message",
        message: {
          role: "toolResult",
          toolName: "bash",
          content: [{ type: "text", text: "Error: boom" }],
        },
      }),
    );
    expect(findPairs(actions)).toHaveLength(0);
  });
});

describe("learnFromSessions + CLI/MCP helpers", () => {
  it("records project-scoped session lessons and reports honestly", () => {
    const file = join(dir, "s.jsonl");
    writeFileSync(file, piSession(), "utf8");
    const report = learnFromSessions([file]);
    expect(report.files).toBe(1);
    expect(report.records).toBe(5);
    expect(report.skipped).toBe(1);
    expect(report.pairs).toBe(1);
    expect(report.lessons).toBe(1);
    const lessons = listLessons();
    expect(lessons).toHaveLength(1);
    expect(lessons[0].step).toBe("session");
    expect(lessons[0].changeId).toBeTruthy();
    expect(lessons[0].fix).toContain("pnpm lint --fix");
  });

  it("deduplicates identical patterns (same changeId+step+error recorded once)", () => {
    const file = join(dir, "s.jsonl");
    writeFileSync(file, piSession(), "utf8");
    learnFromSessions([file]);
    learnFromSessions([file]);
    expect(readLessons()).toHaveLength(1);
  });

  it("returns an honest zero report when nothing failed (no fake learning)", () => {
    const file = join(dir, "clean.jsonl");
    writeFileSync(
      file,
      JSON.stringify({
        type: "message",
        message: {
          role: "toolResult",
          toolName: "bash",
          content: [{ type: "text", text: "ok" }],
        },
      }),
      "utf8",
    );
    const report = learnFromSessions([file]);
    expect(report.pairs).toBe(0);
    expect(report.lessons).toBe(0);
    expect(readLessons()).toHaveLength(0);
  });

  it("sessionFiles collects *.jsonl recursively from a directory", () => {
    mkdirSync(join(dir, "a", "b"), { recursive: true });
    writeFileSync(join(dir, "a", "x.jsonl"), "{}");
    writeFileSync(join(dir, "a", "b", "y.jsonl"), "{}");
    writeFileSync(join(dir, "a", "ignore.txt"), "no");
    expect(sessionFiles(dir)).toHaveLength(2);
    expect(sessionFiles(join(dir, "a", "x.jsonl"))).toHaveLength(1);
    expect(sessionFiles(join(dir, "missing"))).toHaveLength(0);
  });
});

describe("sessionRoleBreakdown (v0.15, metrics --session)", () => {
  it("buckets all five roles with honest ≈ bytes/4 totals", () => {
    const jsonl = [
      JSON.stringify({
        type: "message",
        message: { role: "user", content: [{ type: "text", text: "build a parser" }] },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", text: "let me plan this carefully" },
            { type: "toolCall", id: "a", name: "bash", arguments: { command: "ls" } },
            { type: "text", text: "I will check the files" },
          ],
        },
      }),
      JSON.stringify({
        type: "message",
        message: {
          role: "toolResult",
          toolCallId: "a",
          toolName: "bash",
          content: [{ type: "text", text: "src\npackage.json" }],
        },
      }),
      "not valid json at all",
    ].join("\n");
    const b = sessionRoleBreakdown(jsonl);
    const roles = Object.fromEntries(b.roles.map((r) => [r.role, r.bytes]));
    expect(roles["user"]).toBeGreaterThan(0);
    expect(roles["toolCall"]).toBeGreaterThan(0);
    expect(roles["toolResult"]).toBeGreaterThan(0);
    expect(roles["thinking"]).toBeGreaterThan(0);
    expect(roles["assistant"]).toBeGreaterThan(0);
    expect(b.records).toBe(3);
    expect(b.skipped).toBe(1); // the invalid line is counted, not hidden
    expect(b.totalBytes).toBeGreaterThan(0);
    expect(b.totalTokens).toBe(Math.round(b.totalBytes / 4));
    const shareSum = b.roles.reduce((s, r) => s + r.share, 0);
    expect(shareSum).toBeCloseTo(1, 5);
  });

  it("returns an empty honest breakdown for an empty session", () => {
    const b = sessionRoleBreakdown("");
    expect(b.roles).toEqual([]);
    expect(b.totalBytes).toBe(0);
    expect(b.skipped).toBe(0);
  });
});
