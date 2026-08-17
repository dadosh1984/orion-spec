import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initRepo } from "../src/skills/init/handler.js";

describe("initRepo", () => {
  let cwds: string[] = [];
  let origCwd = process.cwd();

  beforeEach(() => {
    const dir = join(tmpdir(), `orion-init-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    cwds.push(dir);
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    for (const d of cwds) rmSync(d, { recursive: true, force: true });
    cwds = [];
  });

  it("creates the three scaffold files on a fresh repo", () => {
    const r = initRepo();
    expect(r.created.sort()).toEqual([
      ".githooks/pre-commit.sh",
      ".orion/deny.txt",
      "src/config/orionTdd.json",
    ]);
    expect(r.existing).toEqual([]);
    expect(existsSync(join(process.cwd(), ".orion/deny.txt"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/config/orionTdd.json"))).toBe(
      true,
    );
  });

  it("is idempotent — existing files are reported, not overwritten", () => {
    const first = initRepo();
    const second = initRepo();
    expect(first.existing).toEqual([]);
    expect(second.created).toEqual([]);
    expect(second.existing.sort()).toEqual(first.created.sort());
  });
});
