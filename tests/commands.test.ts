import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, main } from "../src/cli/commands.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-cmd-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("extracts the command, args and global flags", () => {
    const { cmd, args, opts } = parseArgs([
      "forge",
      "demo",
      "--no-cache",
      "--dry",
      "--json",
      "extra",
    ]);
    expect(cmd).toBe("forge");
    expect(args).toEqual(["demo", "extra"]);
    expect(opts).toEqual({
      noCache: true,
      dry: true,
      watch: false,
      json: true,
      npm: false,
      port: 0,
      ui: true,
    });
  });
});

describe("main dispatcher", () => {
  it("returns 0 for help", async () => {
    expect(await main(["help"])).toBe(0);
    expect(await main([])).toBe(0);
  });

  it("returns 1 for unknown commands", async () => {
    expect(await main(["bogus"])).toBe(1);
  });

  it("learn records session lessons and reports honestly (v0.13)", async () => {
    writeFileSync(
      join(dir, "sess.jsonl"),
      [
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "a",
                name: "bash",
                arguments: { command: "pnpm lint" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "a",
            toolName: "bash",
            content: [{ type: "text", text: "error: lint problems" }],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "b",
                name: "bash",
                arguments: { command: "pnpm lint --fix" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "b",
            toolName: "bash",
            content: [{ type: "text", text: "clean" }],
          },
        }),
      ].join("\n"),
      "utf8",
    );
    const exit = await main(["learn", join(dir, "sess.jsonl")]);
    expect(exit).toBe(0);
    const lessons = JSON.parse(
      readFileSync(join(dir, "lessons.json"), "utf8"),
    ) as Array<{ step: string; fix: string }>;
    expect(
      lessons.some(
        (l) => l.step === "session" && l.fix.includes("pnpm lint --fix"),
      ),
    ).toBe(true);
  });

  it("learn fails honestly on missing sessions", async () => {
    expect(await main(["learn"])).toBe(1);
    expect(await main(["learn", join(dir, "nope")])).toBe(1);
  });

  it("routes multi-word unknown input to think (natural-language fallback)", async () => {
    expect(await main(["build", "a", "calculator"])).toBe(0);
    expect(
      existsSync(join(dir, "changes", "build-a-calculator", "proposal.json")),
    ).toBe(true);
  });

  it("treats a whole quoted phrase as a prompt (single argv with spaces)", async () => {
    expect(await main(["сделай CLI калькулятор с историей"])).toBe(0);
    // Cyrillic is stripped by slugify, so the title is "cli".
    expect(existsSync(join(dir, "changes", "cli", "proposal.json"))).toBe(true);
  });

  it("tasks prints the checklist with check marks", async () => {
    mkdirSync(join(dir, "changes", "demo"), { recursive: true });
    writeFileSync(
      join(dir, "changes", "demo", "tasks.md"),
      "# Tasks\n- [x] one\n- [ ] two\n",
      "utf8",
    );
    const lines: string[] = [];
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation((...a: unknown[]) => {
        lines.push(a.join(" "));
      });
    try {
      const code = await main(["tasks", "demo"]);
      expect(code).toBe(0);
      expect(lines.join("\n")).toContain("✓ one");
      expect(lines.join("\n")).toContain("· two");
      expect(lines.join("\n")).toContain("1/2");
    } finally {
      spy.mockRestore();
    }
  });

  it("returns 1 for think without a prompt", async () => {
    expect(await main(["think"])).toBe(1);
  });

  it("handles track set/get/status/clear round-trips", async () => {
    expect(await main(["track", "set", "k", "v"])).toBe(0);
    expect(await main(["track", "get", "k"])).toBe(0);
    expect(await main(["track", "status"])).toBe(0);
    expect(await main(["track", "clear"])).toBe(0);
  });

  it("returns 1 for unknown track sub-commands", async () => {
    expect(await main(["track", "bogus"])).toBe(1);
  });

  it("returns 1 for missing argument guards across commands", async () => {
    expect(await main(["track", "get"])).toBe(1);
    expect(await main(["track", "set"])).toBe(1);
    expect(await main(["draft"])).toBe(1);
    expect(await main(["forge"])).toBe(1);
    expect(await main(["shield"])).toBe(1);
    expect(await main(["out"])).toBe(1);
    expect(await main(["tdd", "start"])).toBe(1);
    expect(await main(["tdd", "implement"])).toBe(1);
  });

  it("handles the --json flag via printOut", async () => {
    const out = await main(["track", "status", "--json"]);
    expect(out).toBe(0);
  });

  it("scale --dry previews stages without writing", async () => {
    writeFileSync(
      "preview.ts",
      "import { readFileSync } from 'fs';\n// c\nconsole.log(1);\n",
      "utf8",
    );
    expect(await main(["scale", "preview.ts", "--dry"])).toBe(0);
    expect(existsSync("preview.scaled.ts")).toBe(false);
  });

  it("returns 1 for tdd without arguments", async () => {
    expect(await main(["tdd"])).toBe(1);
  });

  it("returns 0 for scale --dry without a file (dry preview errors on missing file)", async () => {
    // scale requires a file argument
    expect(await main(["scale"])).toBe(1);
  });

  it("handles metrics placeholder", async () => {
    expect(await main(["metrics"])).toBe(0);
  });

  it("tdd finalize caches tdd:<task>=DONE via track", async () => {
    const task = `fin_${Date.now()}`;
    expect(await main(["tdd", "finalize", task])).toBe(0);
    const { OrionTrack } = await import("../src/core/track.js");
    const t = OrionTrack.init();
    expect(t.load(`tdd:${task}`)).toBe("DONE");
  });
});

describe("metrics --session (v0.15)", () => {
  it("renders a per-role breakdown and exits 0", async () => {
    writeFileSync(
      join(dir, "s.jsonl"),
      [
        JSON.stringify({
          type: "message",
          message: { role: "user", content: "hello" },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "a",
                name: "bash",
                arguments: { command: "ls" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "a",
            toolName: "bash",
            content: "src",
          },
        }),
      ].join("\n"),
      "utf8",
    );
    const out: string[] = [];
    const spy = vi
      .spyOn(console, "log")
      .mockImplementation((m) => out.push(String(m)));
    const exit = await main(["metrics", "--session", join(dir, "s.jsonl")]);
    spy.mockRestore();
    expect(exit).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("orion metrics --session");
    expect(text).toContain("user");
    expect(text).toContain("toolCall");
    expect(text).toContain("toolResult");
    expect(text).toContain("bytes/4 estimate");
  });

  it("fails honestly on a missing or non-jsonl path", async () => {
    expect(await main(["metrics", "--session", join(dir, "nope.jsonl")])).toBe(
      1,
    );
    expect(await main(["metrics", "--session", join(dir, "dir")])).toBe(1);
  });

  it("parseArgs consumes --session value (not a positional arg)", () => {
    const { opts, args } = parseArgs([
      "metrics",
      "--session",
      "sess.jsonl",
      "extra",
    ]);
    expect(opts.session).toBe("sess.jsonl");
    expect(args).toEqual(["extra"]);
  });
});

describe("forge --parallel (v0.16)", () => {
  it("parseArgs consumes --parallel <n>", () => {
    const { opts, args } = parseArgs(["forge", "demo", "--parallel", "3", "x"]);
    expect(opts.parallel).toBe(3);
    expect(args).toEqual(["demo", "x"]);
  });

  it("parseArgs rejects invalid --parallel values", () => {
    expect(() => parseArgs(["forge", "demo", "--parallel"])).toThrow();
    expect(() => parseArgs(["forge", "demo", "--parallel", "0"])).toThrow();
    expect(() => parseArgs(["forge", "demo", "--parallel", "abc"])).toThrow();
  });
});
