import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { writeFileSafe, ensureDir, resolveConfig } from "../utils/file.js";
import { OrionTrack } from "./track.js";
import type { TaskStatus, TddConfig } from "../type.js";

const execAsync = promisify(exec);

/** Safe characters for a task identifier (filesystem + shell-safe). */
const TASK_ID_RE = /^[a-zA-Z0-9_-]+$/;

/** RED-GREEN-REFACTOR state machine. */
export enum State {
  RED = "RED",
  GREEN = "GREEN",
  REFACTOR = "REFACTOR",
  DONE = "DONE",
}

/** Load the TDD configuration with defaults. */
export function loadTddConfig(): TddConfig {
  try {
    return JSON.parse(
      readFileSync(resolveConfig("orionTdd.json"), "utf8"),
    ) as TddConfig;
  } catch {
    return {
      testTemplate:
        "import { describe, it, expect } from 'vitest';\n" +
        "import { {{task}} } from '../src/tasks/{{task}}';\n\n" +
        "describe('{{task}}', () => {\n" +
        "  it('works', () => {\n" +
        "    expect({{task}}()).toBeDefined();\n" +
        "  });\n" +
        "});\n",
      testDir: "tests",
      srcDir: "src/tasks",
      command: "pnpm vitest run tests/{{task}}.test.ts",
      minCoverage: 80,
    };
  }
}

/**
 * TddEngine drives one task through RED → GREEN → REFACTOR → DONE.
 */
export class TddEngine {
  readonly task: string;
  state: State = State.RED;
  completed = false;
  /** Honest description of the last test failure (v0.10), if any. */
  lastFailure?: string;
  readonly config: TddConfig;
  readonly track: OrionTrack;

  constructor(task: string, track?: OrionTrack, config?: TddConfig) {
    // Shell/command-injection guard: the task id is interpolated into shell
    // commands and file paths, so only allow safe identifier characters.
    if (!TASK_ID_RE.test(task)) {
      throw new Error(
        `invalid task id "${task}" — only [a-zA-Z0-9_-] are allowed`,
      );
    }
    this.task = task;
    this.track = track ?? OrionTrack.init();
    this.config = config ?? loadTddConfig();
  }

  /** Generate a test file for the task from the template. */
  async generateTest(): Promise<string> {
    const { testDir } = this.config;
    const test = this.config.testTemplate
      .replaceAll("{{task}}", this.task)
      .replaceAll("{{testFile}}", `${this.task}.test.ts`);
    await ensureDir(testDir);
    await writeFileSafe(`${testDir}/${this.task}.test.ts`, test);
    this.state = State.RED;
    return test;
  }

  /** Run the task's tests; returns true when they pass (exit code 0). */
  async runTest(): Promise<boolean> {
    return (await this.runTestDetailed()).passed;
  }

  /**
   * Run the task's tests and honestly report what happened (v0.10): on
   * failure the output names the failing test file and assertion instead
   * of a generic "tests failed".
   */
  async runTestDetailed(): Promise<{ passed: boolean; output: string }> {
    const root = dirname(this.config.testDir);
    const cmd = this.config.command
      .replaceAll("{{task}}", this.task)
      .replaceAll("{{testDir}}", this.config.testDir)
      .replaceAll("{{srcDir}}", this.config.srcDir)
      .replaceAll("{{root}}", root);
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: process.cwd(),
        timeout: 120_000,
      });
      this.state = State.GREEN;
      this.lastFailure = undefined;
      return { passed: true, output: (stdout + stderr).slice(0, 2000) };
    } catch (err) {
      const output =
        (err instanceof Error
          ? `${err.message}\n${err.stack ?? ""}`
          : String(err))
          .slice(0, 4000);
      this.lastFailure = describeFailure(output);
      this.state = State.RED;
      return { passed: false, output };
    }
  }

  /**
   * Extract the exact failing test file, test name and assertion from a
   * vitest run's output. Returns a short, honest summary; falls back to
   * the raw output when nothing is parseable.
   */
  describeFailure(): string | undefined {
    return this.lastFailure;
  }

  /** Apply a user-provided implementation snippet. */
  async applyCode(snippet: string): Promise<void> {
    const { srcDir } = this.config;
    await ensureDir(srcDir);
    await writeFileSafe(`${srcDir}/${this.task}.ts`, snippet);
  }

  /** Advance the state machine based on the latest test run. */
  transition(testPassed: boolean): State {
    if (this.state === State.DONE) return State.DONE;
    // A failing test always resets to RED — a regression after a green run
    // (e.g. `tdd implement --watch`) must be visible, not silently cached.
    if (!testPassed) {
      this.state = State.RED;
      return this.state;
    }
    this.state = State.GREEN;
    return this.state;
  }

  /** Run lint --fix and format to clean the code up. */
  async refactor(): Promise<boolean> {
    try {
      await execAsync("pnpm exec eslint src/tasks --fix", {
        cwd: process.cwd(),
      });
      await execAsync('pnpm exec prettier --write "src/tasks/**/*.ts"', {
        cwd: process.cwd(),
      });
      this.state = State.REFACTOR;
      return true;
    } catch {
      return false;
    }
  }

  /** Mark the task done and record the status in the cache. */
  finalize(): void {
    this.completed = true;
    this.state = State.DONE;
    this.track.store(`tdd:${this.task}`, "DONE");
  }

  /** Current task status for cache/status queries. */
  status(): TaskStatus {
    return this.completed ? "DONE" : (this.state as TaskStatus);
  }
}

/**
 * Parse vitest output into a precise failure summary (v0.10). Looks for the
 * FAIL header (test file + name) and the first assertion message. Never
 * invents details — when nothing parses, says exactly that.
 */
export function describeFailure(output: string): string {
  const head = output.split(/\r?\n/).slice(0, 120).join("\n");

  // vitest marks failing tests with a ✗/× marker and the file:line where
  // the failure happened; the assertion text follows in the summary block.
  const fileMatch = head.match(/\u2717|\u00d7/);
  const failLines: string[] = [];
  for (const line of head.split(/\r?\n/)) {
    if (
      /FAIL|failed|✗|×|AssertionError|expected .* to (?:be|equal|deep|match)|Unhandled Rejection|Cannot find module|SyntaxError|TypeError|ReferenceError/.test(
        line,
      )
    ) {
      failLines.push(line.trim().slice(0, 160));
    }
    if (failLines.length >= 3) break;
  }

  if (failLines.length === 0) {
    return fileMatch
      ? "tests failed (see vitest output below)"
      : "test run failed — the output did not name a failing assertion; this is reported as-is (no details were invented)";
  }
  return failLines.join(" · ");
}
