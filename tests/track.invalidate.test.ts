import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrionTrack } from "../src/core/track.js";

let dir: string;
let track: OrionTrack;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-inv-"));
  track = new OrionTrack(join(dir, "cache"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("OrionTrack.invalidate", () => {
  it("deletes the requested keys", () => {
    track.store("a", 1);
    track.store("b", 2);
    track.store("c", 3);
    track.invalidate(["a", "c"]);
    expect(track.exists("a")).toBe(false);
    expect(track.exists("b")).toBe(true);
    expect(track.exists("c")).toBe(false);
  });

  it("is a no-op for keys that do not exist", () => {
    expect(() => track.invalidate(["ghost"])).not.toThrow();
  });

  it("allows re-storing after invalidation", () => {
    track.store("x", "old");
    track.invalidate(["x"]);
    track.store("x", "new");
    expect(track.load("x")).toBe("new");
  });
});
