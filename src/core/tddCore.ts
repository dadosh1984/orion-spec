import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { writeFileSafe, ensureDir, resolveConfig } from "../utils/file.js";
import { trace } from "./telemetry.js";
import { OrionTrack } from "./track.js";
import { scanHazards, HAZARD_GATE_BLOCKED } from "./hazards.js";
import type { TaskStatus, TddConfig } from "../type.js";

const execAsync = promisify(exec);

/** Safe characters for a task identifier (filesystem + shell-safe).
 * v0.24: Unicode letters are allowed — Cyrillic task slugs must work, the
 * same promise as change titles. Still no shell metacharacters, so the
 * injection guard holds. */
const TASK_ID_RE = /^[\p{L}\p{N}_-]+$/u;

/** RED-GREEN-REFACTOR state machine. */
export enum State {
  RED = "RED",
  GREEN = "GREEN",
  REFACTOR = "REFACTOR",
  DONE = "DONE",
}

/** Load the TDD configuration with defaults. */
export function loadTddConfig(): TddConfig {
  const DEFAULTS: TddConfig = {
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
    command: "pnpm vitest run tests/{{testFile}}",
    minCoverage: 80,
    testExt: ".test.ts",
    srcExt: ".ts",
  };
  try {
    const cfg = JSON.parse(
      readFileSync(resolveConfig("orionTdd.json"), "utf8"),
    ) as Partial<TddConfig>;
    // File suffixes are optional: a project's orionTdd.json may omit them
    // and still get the TS defaults (v0.24 framework-agnostic extensions).
    return {
      ...DEFAULTS,
      ...cfg,
      testExt: cfg.testExt ?? DEFAULTS.testExt,
      srcExt: cfg.srcExt ?? DEFAULTS.srcExt,
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Lightweight JSON-Schema-style validation of orionTdd.json (v0.29, T5.5).
 * Zero dependency: hand-checked types + range against the DEFAULTS shape.
 * Returns [] when the file is absent/invalid — the caller falls back to
 * DEFAULTS, so a broken config degrades, never crashes.
 */
export function validateTddConfig(): string[] {
  try {
    const raw = JSON.parse(
      readFileSync(resolveConfig("orionTdd.json"), "utf8"),
    ) as Record<string, unknown>;
    const issues: string[] = [];
    if (
      typeof raw.minCoverage === "number" &&
      (raw.minCoverage < 0 || raw.minCoverage > 100)
    )
      issues.push(`minCoverage ${raw.minCoverage} out of 0..100`);
    for (const key of [
      "testTemplate",
      "testDir",
      "srcDir",
      "command",
      "testExt",
      "srcExt",
    ] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== "string")
        issues.push(`${key} must be a string`);
    }
    return issues;
  } catch {
    return [];
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
        `invalid task id "${task}" — only letters, digits, _ and - are allowed`,
      );
    }
    this.task = task;
    this.track = track ?? OrionTrack.init();
    // Normalize optional file suffixes (v0.24): callers may pass a partial
    // TddConfig (tests, plugins) that omits testExt/srcExt — never let
    // `${task}${undefined}` become a filename.
    const base = config ?? loadTddConfig();
    this.config = {
      ...base,
      testExt: base.testExt ?? ".test.ts",
      srcExt: base.srcExt ?? ".ts",
    };
  }

  /** Generate a test file for the task from the template. */
  async generateTest(): Promise<string> {
    const { testDir, testExt } = this.config;
    const testFile = `${this.task}${testExt}`;
    const test = this.config.testTemplate
      .replaceAll("{{task}}", this.task)
      .replaceAll("{{testFile}}", testFile);
    await ensureDir(testDir);
    await writeFileSafe(`${testDir}/${testFile}`, test);
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
    // Hazard gate (v0.23): also scan the files the test runner is about to
    // import. applyCode already blocks snippets, but a test file written by
    // hand (or a snippet that slipped past the static check) must not run
    // either — gate before exec, never after.
    const hazards = [
      ...scanHazards(
        safeRead(`${this.config.testDir}/${this.task}${this.config.testExt}`),
      ),
      ...scanHazards(
        safeRead(`${this.config.srcDir}/${this.task}${this.config.srcExt}`),
      ),
    ];
    if (hazards.length > 0) {
      this.state = State.RED;
      trace({ type: "tdd", state: "BLOCKED", task: this.task });
      return {
        passed: false,
        output: `${HAZARD_GATE_BLOCKED} ${hazards.join("; ")} — not executed`,
      };
    }
    const root = dirname(this.config.testDir);
    const cmd = this.config.command
      .replaceAll("{{task}}", this.task)
      .replaceAll("{{testFile}}", `${this.task}${this.config.testExt}`)
      .replaceAll("{{testDir}}", this.config.testDir)
      .replaceAll("{{srcDir}}", this.config.srcDir)
      .replaceAll("{{root}}", root);
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: process.cwd(),
        timeout: 120_000,
        // v0.24: give the nested vitest run its own transform cache so it
        // never races the outer run's node_modules/.vite (see
        // vitest.config.ts cache.dir). Isolated per project/test dir.
        env: {
          ...process.env,
          ORION_TDD_CACHE_DIR: join(root, ".orion-vitest-cache"),
        },
      });
      this.state = State.GREEN;
      this.lastFailure = undefined;
      return { passed: true, output: (stdout + stderr).slice(0, 2000) };
    } catch (err) {
      const output = (
        err instanceof Error
          ? `${err.message}\n${err.stack ?? ""}`
          : String(err)
      ).slice(0, 4000);
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
    // Hazard gate (v0.23): refuse destructive/escaping code BEFORE it is
    // written to src/ — a written file is one import away from running.
    const hazards = scanHazards(snippet);
    if (hazards.length > 0) {
      throw new Error(
        `${HAZARD_GATE_BLOCKED} snippet refused: ${hazards.join("; ")} — ` +
          "review the code, remove the destructive call, then re-apply",
      );
    }
    const { srcDir, srcExt } = this.config;
    await ensureDir(srcDir);
    await writeFileSafe(`${srcDir}/${this.task}${srcExt}`, snippet);
  }

  /** Advance the state machine based on the latest test run. */
  transition(testPassed: boolean): State {
    if (this.state === State.DONE) return State.DONE;
    // A failing test always resets to RED — a regression after a green run
    // (e.g. `tdd implement --watch`) must be visible, not silently cached.
    if (!testPassed) {
      this.state = State.RED;
      trace({ type: "tdd", state: "RED", task: this.task });
      return this.state;
    }
    this.state = State.GREEN;
    trace({ type: "tdd", state: "GREEN", task: this.task });
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

/** Read a file for the hazard scan; missing/unreadable → "" (fail-safe). */
function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
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
