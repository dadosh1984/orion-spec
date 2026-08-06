import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { TddEngine } from "../core/tddCore.js";
import { CliOptions, printOut, fail } from "./helpers.js";

/** `orion tdd <sub>` — the RED-GREEN-REFACTOR engine. */
export async function tddCommand(
  args: string[],
  opts: CliOptions,
): Promise<number> {
  const [sub, task, path] = args;
  if (!sub || !task)
    return fail(
      "tdd requires: tdd start <task> | tdd implement <task> <path> | tdd refactor <task>",
    );
  const engine = new TddEngine(task);
  switch (sub) {
    case "start": {
      const test = await engine.generateTest();
      printOut(
        opts,
        { task, state: engine.state, test },
        `RED: generated test for "${task}". Implement it, then: orion tdd implement ${task} <path>`,
      );
      return 0;
    }
    case "implement": {
      if (!path) return fail("tdd implement requires a snippet path");
      const runOnce = async (): Promise<boolean> => {
        const snippet = await readFile(path, "utf8");
        await engine.applyCode(snippet);
        const passed = await engine.runTest();
        engine.transition(passed);
        const why = engine.describeFailure();
        printOut(
          opts,
          { task, state: engine.state, passed, failure: why },
          passed
            ? "GREEN: tests pass"
            : `RED: tests still failing — ${why ?? "no detail captured"}`,
        );
        return passed;
      };
      const passed = await runOnce();
      if (opts.watch) {
        // --watch: re-run the tests automatically after every edit.
        console.log(
          `[watch] watching ${path} — edit to re-run tests (Ctrl+C to stop)`,
        );
        const watcher = watch(path, async () => {
          try {
            await runOnce();
          } catch (err) {
            console.error(
              `orion: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        });
        process.once("SIGINT", () => {
          watcher.close();
          process.exit(0);
        });
        await new Promise<void>(() => {
          /* keep the process alive until SIGINT */
        });
      }
      return passed ? 0 : 1;
    }
    case "refactor": {
      await engine.refactor();
      printOut(
        opts,
        { task, state: engine.state },
        "REFACTOR: lint --fix + format applied",
      );
      return 0;
    }
    case "finalize": {
      engine.finalize();
      printOut(
        opts,
        { task, status: engine.status() },
        `DONE: task "${task}" finalized and cached as tdd:${task}`,
      );
      return 0;
    }
    default:
      return fail(`unknown tdd sub-command "${sub}"`);
  }
}
