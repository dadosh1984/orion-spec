import { describe, it, expect } from "vitest";
import { scanChanges, listTable } from "../src/cli/overviewCmd.js";
import { printOut } from "../src/cli/helpers.js";

describe("orion ls --json (machine-readable change list)", () => {
  it("scanChanges returns ChangeRow[] with machine-readable fields", () => {
    const rows = scanChanges();
    for (const r of rows) {
      expect(r).toMatchObject({
        title: expect.any(String),
        tasks: expect.any(Number),
        done: expect.any(Number),
        status: expect.stringMatching(/^(DONE|INCOMPLETE)$/),
        changedAt: expect.any(String),
      });
    }
  });

  it("JSON.stringify of ChangeRow[] is valid JSON with the expected shape", () => {
    const rows = scanChanges();
    const json = JSON.stringify(rows, null, 2);
    const parsed = JSON.parse(json) as Array<{
      title: string;
      tasks: number;
      done: number;
      status: string;
      changedAt: string;
    }>;
    expect(Array.isArray(parsed)).toBe(true);
    for (const r of parsed) {
      expect(typeof r.title).toBe("string");
      expect(typeof r.tasks).toBe("number");
      expect(typeof r.done).toBe("number");
      expect(["DONE", "INCOMPLETE"]).toContain(r.status);
      expect(!Number.isNaN(Date.parse(r.changedAt))).toBe(true);
    }
  });

  it("listTable renders a human table (non-json fallback)", () => {
    const table = listTable(scanChanges());
    expect(typeof table).toBe("string");
    expect(table.length).toBeGreaterThan(0);
  });

  it("printOut branches on opts.json", () => {
    const captured: string[] = [];
    const orig = console.log;
    console.log = (s: string) => captured.push(String(s));
    try {
      printOut(
        { json: true } as never,
        [{ title: "x", tasks: 1, done: 0, status: "INCOMPLETE", changedAt: "2026-01-01T00:00:00Z" }],
        "plain",
      );
      const parsed = JSON.parse(captured[0]);
      expect(parsed[0].title).toBe("x");
    } finally {
      console.log = orig;
    }
  });
});
