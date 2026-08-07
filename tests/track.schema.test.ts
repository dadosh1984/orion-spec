import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OrionTrack, SCHEMA_VERSION } from "../src/core/track.js";

let dir: string;
let track: OrionTrack;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-schema-"));
  track = OrionTrack.init(join(dir, "cache"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("OrionTrack cache schema versioning", () => {
  it("writes the current schema version into every stored entry", () => {
    track.store("proposal:demo", { goal: "x" });
    const entry = JSON.parse(
      readFileSync(track.entryPath("proposal:demo"), "utf8"),
    ) as { schema: number; value: unknown };
    expect(entry.schema).toBe(SCHEMA_VERSION);
  });

  it("loads entries whose schema version matches", () => {
    track.store("k", "v");
    expect(track.load("k")).toBe("v");
    expect(track.loadWithDate("k")?.value).toBe("v");
  });

  it("rejects entries written with an incompatible (future) schema version", () => {
    writeFileSync(
      track.entryPath("stale"),
      JSON.stringify({
        schema: SCHEMA_VERSION + 999,
        value: "old",
        storedAt: "2025-01-01",
      }),
      "utf8",
    );
    expect(track.load("stale")).toBeNull();
    expect(track.loadWithDate("stale")).toBeNull();
    // The stale file is dropped so it cannot be trusted again later.
    expect(existsSync(track.entryPath("stale"))).toBe(false);
  });

  it("accepts legacy entries that predate schema versioning", () => {
    writeFileSync(
      track.entryPath("legacy"),
      JSON.stringify({ value: "old-format", storedAt: "2025-01-01" }),
      "utf8",
    );
    expect(track.load("legacy")).toBe("old-format");
  });

  it("treats corrupt entries as missing (still null)", () => {
    writeFileSync(track.entryPath("bad"), "{ not json", "utf8");
    expect(track.load("bad")).toBeNull();
  });

  it("exposes the schema version through getStats() and the instance", () => {
    expect(track.schemaVersion).toBe(SCHEMA_VERSION);
    expect(track.getStats().schemaVersion).toBe(SCHEMA_VERSION);
  });
});
