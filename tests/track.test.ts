import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrionTrack } from "../src/core/track.js";

let dir: string;
let track: OrionTrack;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-track-"));
  track = new OrionTrack(join(dir, "cache"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("OrionTrack", () => {
  it("creates the cache directory on construction", () => {
    expect(existsSync(track.cacheDir)).toBe(true);
  });

  it("stores and loads a value", () => {
    track.store("hello", "world");
    expect(track.load("hello")).toBe("world");
  });

  it("returns null for missing or corrupt entries", () => {
    expect(track.load("nope")).toBeNull();
    writeFileSync(track.entryPath("corrupt"), "not json", "utf8");
    expect(track.load("corrupt")).toBeNull();
  });

  it("exists() reflects stored entries", () => {
    expect(track.exists("a")).toBe(false);
    track.store("a", 1);
    expect(track.exists("a")).toBe(true);
  });

  it("stores with a timestamp", () => {
    track.store("t", "v");
    const entry = JSON.parse(readFileSync(track.entryPath("t"), "utf8")) as {
      storedAt: string;
    };
    expect(entry.storedAt).toBeTruthy();
    expect(new Date(entry.storedAt).getTime()).not.toBeNaN();
  });

  it("handles keys with special characters (Windows-safe)", () => {
    track.store("scale:yagni:abc123", "cached");
    expect(track.load("scale:yagni:abc123")).toBe("cached");
  });

  it("prunes old entries when the total size exceeds maxSize", () => {
    const small = new OrionTrack(join(dir, "small"), join(dir, "cfg.json"));
    writeFileSync(
      join(dir, "cfg.json"),
      JSON.stringify({ maxSize: 10, ttlDays: 30 }),
      "utf8",
    );
    small.store("big1", "x".repeat(100));
    small.store("big2", "y".repeat(100));
    const removed = small.prune();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(small.getStats().size).toBeLessThanOrEqual(10);
  });

  it("clears the whole cache", () => {
    track.store("a", 1);
    track.store("b", 2);
    track.clear();
    expect(track.getStats().count).toBe(0);
  });

  it("batch() loads multiple keys in parallel", async () => {
    track.store("k1", "v1");
    track.store("k2", "v2");
    const result = await track.batch(["k1", "k2", "missing"]);
    expect(result).toEqual({ k1: "v1", k2: "v2" });
  });

  it("invalidate() removes specific entries", () => {
    track.store("a", 1);
    track.store("b", 2);
    track.invalidate(["a"]);
    expect(track.exists("a")).toBe(false);
    expect(track.exists("b")).toBe(true);
  });

  it("getStats() reports count and size", () => {
    track.store("a", "12345");
    const stats = track.getStats();
    expect(stats.count).toBe(1);
    expect(stats.size).toBeGreaterThan(0);
  });
});
