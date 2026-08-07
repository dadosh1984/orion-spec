import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  forgeParallel,
  chunks,
  forkRunner,
  refactorAll,
  type WaveRunner,
  type WaveWorkerReply,
} from "../src/skills/forge/handler.js";
import { OrionTrack } from "../src/core/track.js";
import { readLessons } from "../src/core/lessons.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-waves-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  process.chdir(ORIGINAL_CWD);
  // Windows: a killed fork worker may still hold the fixture dir as its
  // cwd for a moment, so rmSync can EPERM — retry with a small pause until
  // the OS frees the handle.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      break;
    } catch {
      if (attempt === 19) throw new Error(`could not clean up ${dir}`);
      const start = Date.now();
      while (Date.now() - start < 60) {
        /* busy-wait: rmSync is sync, setTimeout cannot run mid-call */
      }
    }
  }
});

function seedChange(title: string, tasks: string[]): void {
  const changeDir = join("changes", title);
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(
    join(changeDir, "tasks.md"),
    ["# Tasks", "", ...tasks.map((t) => `- [ ] ${t}`), ""].join("\n"),
    "utf8",
  );
}

describe("chunks (v0.16)", () => {
  it("splits into sequential batches of the given size", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
    expect(chunks([], 3)).toEqual([]);
  });
});

describe("forgeParallel (v0.16)", () => {
  it("runs tasks in waves of the configured size, in order", async () => {
    seedChange("demo", [
      "Task alpha",
      "Task beta",
      "Task gamma",
      "Task delta",
      "Task epsilon",
    ]);
    const seenWaves: string[][] = [];
    const runner: WaveRunner = async (_title, slugs) => {
      seenWaves.push(slugs);
      return slugs.map(
        (slug): WaveWorkerReply => ({ slug, status: "done", reason: "red" }),
      );
    };
    const summary = await forgeParallel(
      "demo",
      { parallel: 2, refactor: async () => {} },
      runner,
    );
    expect(seenWaves).toEqual([
      ["task_alpha", "task_beta"],
      ["task_gamma", "task_delta"],
      ["task_epsilon"],
    ]);
    expect(summary.done).toBe(5);
    expect(summary.ok).toBe(true);
    expect(summary.message).toContain("3 wave(s) of 2");
  });

  it("applies parent-side bookkeeping exactly once per done task", async () => {
    seedChange("demo", ["Implement add", "Implement sub"]);
    const runner: WaveRunner = async (_title, slugs) =>
      slugs.map(
        (slug): WaveWorkerReply => ({ slug, status: "done", reason: "red" }),
      );
    const summary = await forgeParallel(
      "demo",
      { parallel: 2, refactor: async () => {} },
      runner,
    );
    expect(summary.done).toBe(2);
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks.match(/- \[x\]/g)).toHaveLength(2);
    const track = OrionTrack.init();
    expect(track.loadString("forge:implement_add")).toBe("DONE");
    expect(track.loadString("forge:implement_sub")).toBe("DONE");
  });

  it("reports RED as pending and records a lesson (self-correction)", async () => {
    seedChange("demo", ["Implement add"]);
    const runner: WaveRunner = async (_title, slugs) =>
      slugs.map(
        (slug): WaveWorkerReply => ({
          slug,
          status: "pending",
          reason: "red",
          lastFailure: "expected 2 to equal 3",
        }),
      );
    const summary = await forgeParallel(
      "demo",
      { parallel: 2, refactor: async () => {} },
      runner,
    );
    expect(summary.ok).toBe(false);
    expect(summary.pending).toEqual(["implement_add"]);
    expect(summary.missingSnippets[0]).toContain("implement_add.ts");
    const lessons = readLessons();
    expect(lessons.some((l) => l.changeId === "demo" && l.step === "forge")).toBe(
      true,
    );
    // RED never ticks the task done
    expect(readFileSync(join("changes", "demo", "tasks.md"), "utf8")).not.toContain(
      "- [x]",
    );
  });

  it("no-snippet pending records no lesson and no cache key", async () => {
    seedChange("demo", ["Implement add"]);
    const runner: WaveRunner = async (_title, slugs) =>
      slugs.map(
        (slug): WaveWorkerReply => ({
          slug,
          status: "pending",
          reason: "no-snippet",
          lastFailure: "missing implementation snippet",
        }),
      );
    const summary = await forgeParallel(
      "demo",
      { parallel: 2, refactor: async () => {} },
      runner,
    );
    expect(summary.ok).toBe(false);
    expect(readLessons()).toEqual([]);
    const track = OrionTrack.init();
    expect(track.loadString("forge:implement_add")).toBeNull();
  });

  it("skips cached DONE tasks before any worker starts", async () => {
    seedChange("demo", ["Implement add", "Implement sub"]);
    const track = OrionTrack.init();
    track.store("forge:implement_add", "DONE");
    let calls = 0;
    const runner: WaveRunner = async (_title, slugs) => {
      calls += slugs.length;
      return slugs.map(
        (slug): WaveWorkerReply => ({ slug, status: "done", reason: "red" }),
      );
    };
    const summary = await forgeParallel(
      "demo",
      { parallel: 2, refactor: async () => {} },
      runner,
    );
    expect(summary.skipped).toBe(1);
    expect(calls).toBe(1); // only implement_sub reached a worker
    const tasks = readFileSync(join("changes", "demo", "tasks.md"), "utf8");
    expect(tasks).toContain("- [x] Implement add");
    expect(tasks).toContain("- [x] Implement sub");
  });

  it("fires onTask for live progress rows", async () => {
    seedChange("demo", ["Implement add"]);
    const runner: WaveRunner = async (_title, slugs) =>
      slugs.map(
        (slug): WaveWorkerReply => ({ slug, status: "done", reason: "red" }),
      );
    const seen: string[] = [];
    await forgeParallel(
      "demo",
      {
        parallel: 2,
        refactor: async () => {},
        onTask: (row) => seen.push(`${row.status}:${row.desc}`),
      },
      runner,
    );
    expect(seen).toEqual(["done:Implement add"]);
  });
});

describe("forkRunner (v0.16)", () => {
  it("forks one worker per task and collects replies", async () => {
    const worker = join(dir, "ok-worker.cjs");
    writeFileSync(
      worker,
      `process.on("message", (m) => { process.send({ slug: m.slug, status: "done", reason: "red" }); process.exit(0); });`,
      "utf8",
    );
    const replies = await forkRunner("demo", ["a", "b"], {}, worker);
    expect(replies).toHaveLength(2);
    expect(replies.every((r) => r.status === "done")).toBe(true);
    expect(replies.map((r) => r.slug)).toEqual(["a", "b"]);
  });

  it("reports a crashing worker honestly as pending", async () => {
    const worker = join(dir, "crash-worker.cjs");
    writeFileSync(worker, `process.exit(3);`, "utf8");
    const replies = await forkRunner("demo", ["a"], {}, worker);
    expect(replies[0].status).toBe("pending");
    expect(replies[0].lastFailure).toContain("code 3");
  });

  it("reports a clean exit without reply honestly as pending", async () => {
    const worker = join(dir, "silent-worker.cjs");
    writeFileSync(worker, `process.exit(0);`, "utf8");
    const replies = await forkRunner("demo", ["a"], {}, worker);
    expect(replies[0].status).toBe("pending");
    expect(replies[0].lastFailure).toContain("without replying");
  });

  it("kills a hung worker after the timeout and reports pending (v0.20)", async () => {
    const worker = join(dir, "hung-worker.cjs");
    // Keeps the event loop alive, never replies, never exits.
    writeFileSync(worker, `setInterval(() => {}, 1000);`, "utf8");
    const prev = process.env.ORION_FORGE_TASK_TIMEOUT_MS;
    process.env.ORION_FORGE_TASK_TIMEOUT_MS = "300";
    try {
      const replies = await forkRunner("demo", ["a"], {}, worker);
      expect(replies[0].status).toBe("pending");
      expect(replies[0].reason).toBe("timeout");
      expect(replies[0].lastFailure).toContain("hung");
    } finally {
      if (prev === undefined) delete process.env.ORION_FORGE_TASK_TIMEOUT_MS;
      else process.env.ORION_FORGE_TASK_TIMEOUT_MS = prev;
    }
  });

  it("refactorAll runs the real eslint/prettier pass (best effort)", async () => {
    // refactorAll operates on the repo's own src/tasks; run it from the
    // real repo cwd, then restore the isolated fixture cwd.
    process.chdir(ORIGINAL_CWD);
    try {
      await expect(refactorAll()).resolves.toBeUndefined();
    } finally {
      process.chdir(dir);
    }
  });
});
