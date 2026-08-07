import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shield } from "../src/skills/shield/handler.js";
import {
  recordDebt,
  closeDebt,
  listDebt,
  countOpenDebt,
  readDebt,
} from "../src/core/debt.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-debt-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
  process.env.ORION_DEBT_FILE = join(dir, "debt.json");
  process.env.ORION_SHIELD_SKIP_SHELL = "1";
  mkdirSync(join("changes", "demo"), { recursive: true });
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_DEBT_FILE;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

describe("debt registry (v0.18)", () => {
  it("records and closes entries idempotently", () => {
    mkdirSync(join("changes", "demo", "snippets"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "snippets", "big.ts"),
      "export const big = 1;\n",
      "utf8",
    );
    recordDebt("changes/demo/snippets/big.ts", 212, 12);
    recordDebt("changes/demo/snippets/big.ts", 220, 12); // refresh, no dup
    expect(listDebt()).toHaveLength(1);
    expect(countOpenDebt()).toBe(1);
    closeDebt("changes/demo/snippets/big.ts");
    expect(countOpenDebt()).toBe(0);
    expect(readDebt()[0].closedAt).toBeDefined();
  });

  it("reopens a closed entry when warned again", () => {
    writeFileSync("a.ts", "export const a = 1;\n", "utf8");
    recordDebt("a.ts", 200, 10);
    closeDebt("a.ts");
    recordDebt("a.ts", 210, 10);
    expect(countOpenDebt()).toBe(1);
    expect(readDebt()).toHaveLength(1);
  });

  it("closes an open debt whose snippet file no longer exists (v0.20)", () => {
    writeFileSync("ghost.ts", "export const g = 1;\n", "utf8");
    recordDebt("ghost.ts", 150, 10);
    expect(countOpenDebt()).toBe(1);

    // The snippet disappears (deleted / change archived) — the next read
    // must self-heal: the entry closes itself, keeping the audit trail.
    rmSync("ghost.ts");
    expect(countOpenDebt()).toBe(0);
    const rows = readDebt();
    expect(rows).toHaveLength(1);
    expect(rows[0].closedAt).toBeDefined();
  });

  it("shield WARN records the debt, shield PASS closes it", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync("src/base.ts", "export const a = 1;\nexport const b = 2;\n", "utf8");
    mkdirSync("changes/demo/snippets", { recursive: true });
    const big = Array.from({ length: 220 }, (_, i) => `const v${i} = ${i};`).join("\n");
    writeFileSync("changes/demo/snippets/big.ts", big + "\nexport const big = 1;\n", "utf8");

    const report = await shield("demo", { noCache: true });
    expect(report.checks.find((c) => c.step === "yagni")?.status).toBe("WARN");
    expect(countOpenDebt()).toBe(1);
    expect(listDebt()[0].snippet).toContain("big.ts");
    expect(listDebt()[0].loc).toBeGreaterThan(200);

    // fix the snippet → PASS closes the debt
    writeFileSync("changes/demo/snippets/big.ts", "export const small = 1;\n", "utf8");
    const report2 = await shield("demo", { noCache: true });
    expect(report2.checks.find((c) => c.step === "yagni")?.status).toBe("PASS");
    expect(countOpenDebt()).toBe(0);
    expect(readDebt()[0].closedAt).toBeDefined();
  });

  it("a cache-hit run never mutates the debt ledger (no stale signal)", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync("src/base.ts", "export const a = 1;\nexport const b = 2;\n", "utf8");
    mkdirSync("changes/demo/snippets", { recursive: true });
    writeFileSync("changes/demo/snippets/small.ts", "export const s = 1;\n", "utf8");

    await shield("demo"); // run 1: yagni PASS, cached
    expect(countOpenDebt()).toBe(0);
    // same hash run 2: yagni SKIPs from cache → no debt mutation
    await shield("demo");
    expect(countOpenDebt()).toBe(0);
    expect(readDebt()).toHaveLength(0);
  });
});
