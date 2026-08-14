import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { memoryHandler, memorySummary } from "../src/cli/memoryCmd.js";

// A minimal OrionTrack-shaped stub for the memory facade (it only needs
// getStats). The real track is injected by commands.ts.
const track = {
  getStats: () => ({ count: 5, size: 1024 }),
} as never;

const ORIG_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-memory-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("orion memory (B2) — grouped state view", () => {
  it("memorySummary builds a well-shaped report", async () => {
    const m = await memorySummary(track as never);
    expect(m.profile).toBeDefined();
    expect(typeof m.profile.lang).toBe("string");
    expect(m.cache.entries).toBe(5);
    expect(m.cache.bytes).toBe(1024);
    expect(typeof m.lessons).toBe("number");
    expect(typeof m.envVars).toBe("number");
  });

  it("memory (no/`-` arg) prints the overview", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const code = await memoryHandler(track as never, []);
    expect(code).toBe(0);
    expect(log.mock.calls.join("")).toContain("Orion memory");
    log.mockRestore();
  });

  it("memory cache prints entry count + size", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await memoryHandler(track as never, ["cache"]);
    expect(log.mock.calls.join("")).toContain("5");
    expect(log.mock.calls.join("")).toContain("1024 B");
    log.mockRestore();
  });

  it("memory unknown sub-command → warn, exit 1", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const code = await memoryHandler(track as never, ["bogus"]);
    expect(code).toBe(1);
    expect(log.mock.calls.join("")).toContain("unknown sub-command");
    log.mockRestore();
  });
});
