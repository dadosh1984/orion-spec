import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { promisify } from "node:util";
import { writeFileSafe, ensureDir } from "../utils/file.js";
import { OrionTrack } from "./track.js";
import type { TaskStatus, TddConfig } from "../type.js";

const execAsync = promisify(exec);

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
      readFileSync(resolve("src/config/orionTdd.json"), "utf8"),
    ) as TddConfig;
  } catch {
    return {
      testTemplate:
        "import { describe, it, expect } from 'vitest';\nimport { {{task}} } from '../src/tasks/{{task}}';\n",
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
  readonly config: TddConfig;
  readonly track: OrionTrack;

  constructor(task: string, track?: OrionTrack, config?: TddConfig) {
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
    const root = dirname(this.config.testDir);
    const cmd = this.config.command
      .replaceAll("{{task}}", this.task)
      .replaceAll("{{testDir}}", this.config.testDir)
      .replaceAll("{{srcDir}}", this.config.srcDir)
      .replaceAll("{{root}}", root);
    try {
      await execAsync(cmd, { cwd: process.cwd(), timeout: 120_000 });
      this.state = State.GREEN;
      return true;
    } catch {
      return false;
    }
  }

  /** Apply a user-provided implementation snippet. */
  async applyCode(snippet: string): Promise<void> {
    const { srcDir } = this.config;
    await ensureDir(srcDir);
    await writeFileSafe(`${srcDir}/${this.task}.ts`, snippet);
  }

  /** Advance the state machine based on the latest test run. */
  transition(testPassed: boolean): State {
    if (this.state === State.RED && !testPassed) return State.RED;
    if (testPassed && this.state !== State.DONE) this.state = State.GREEN;
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
