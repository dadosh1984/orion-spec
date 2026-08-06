import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrionTrack } from "../src/core/track.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-ttl-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("OrionTrack TTL pruning", () => {
  it("removes entries older than ttlDays", () => {
    const cfgPath = join(dir, "cfg.json");
    writeFileSync(
      cfgPath,
      JSON.stringify({ maxSize: 1_000_000, ttlDays: 1 }),
      "utf8",
    );
    const track = new OrionTrack(join(dir, "cache"), cfgPath);

    track.store("fresh", "value");
    // Fake an old file by rewriting its mtime into the past (2 days ago).
    const oldKey = track.entryPath("ancient");
    track.store("ancient", "value");
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(oldKey, past, past);

    const removed = track.prune();
    expect(removed).toBe(1);
    expect(track.exists("ancient")).toBe(false);
    expect(track.exists("fresh")).toBe(true);
  });

  it("keeps entries when ttlDays is 0 (never expires)", () => {
    const cfgPath = join(dir, "cfg.json");
    writeFileSync(
      cfgPath,
      JSON.stringify({ maxSize: 1_000_000, ttlDays: 0 }),
      "utf8",
    );
    const track = new OrionTrack(join(dir, "cache"), cfgPath);
    track.store("keep", "value");
    const removed = track.prune();
    expect(removed).toBe(0);
    expect(track.exists("keep")).toBe(true);
  });
});
