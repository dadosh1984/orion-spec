import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readReceipt,
  deriveBadgeStatus,
  fallbackStatus,
  renderBadgeSvg,
  renderBadgeMarkdown,
  writeBadge,
} from "../src/skills/out/badge.js";

const ORIG_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-badge-"));
  process.chdir(dir);
  mkdirSync("changes/demo", { recursive: true });
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(dir, { recursive: true, force: true });
});

function stubbed() {
  return { change: "demo", ts: "2026-01-01T00:00:00Z", sha256: "abc123" };
}

describe("SVG Badge (v0.52, 2.4) — honesty traps", () => {
  it("Trap 1: no receipt.json → grey 'not verified', never green", () => {
    expect(existsSync("changes/demo/receipt.json")).toBe(false);
    const res = writeBadge("demo");
    expect(res).not.toBeNull();
    expect(res!.status).toBe("not verified");
    expect(res!.svgPath).toBe("changes/demo/badge.svg");
    const svg = readFileSync("changes/demo/badge.svg", "utf8");
    expect(svg).toContain("#9f9f9f"); // grey fill, not green #4c1
    expect(svg).not.toContain("#4c1");
    expect(svg).toContain("not verified");
  });

  it("Trap 2: deterministic — one receipt.json → byte-identical SVG", () => {
    writeFileSync(
      "changes/demo/receipt.json",
      JSON.stringify({
        ...stubbed(),
        status: "verified",
        tests: "791 passing, 2 skipped",
        specSource: "1/1 symbols matched",
        hazards: "0 destructive patterns",
        coverage: "not measured",
      }),
      "utf8",
    );
    const a = renderBadgeSvg(readReceipt("demo")!);
    const b = renderBadgeSvg(readReceipt("demo")!);
    expect(a).toBe(b);
    // two independent writeBadge calls also identical
    const w1 = writeBadge("demo")!;
    const w2 = writeBadge("demo")!;
    expect(readFileSync(w1.svgPath, "utf8")).toBe(
      readFileSync(w2.svgPath, "utf8"),
    );
  });

  it("Trap 3: status from receipt fields, no shield re-run", () => {
    // A receipt that would be 'partial' if only the fields are read (coverage
    // not measured) must NOT silently flip to verified.
    writeFileSync(
      "changes/demo/receipt.json",
      JSON.stringify({
        ...stubbed(),
        status: "partial",
        tests: "10 passing, 0 skipped",
        specSource: "1/1 symbols matched",
        hazards: "0 destructive patterns",
        coverage: "not measured",
      }),
      "utf8",
    );
    expect(deriveBadgeStatus(readReceipt("demo")!)).toBe("partial");
    const svg = renderBadgeSvg(readReceipt("demo")!);
    expect(svg).toContain("#dfb317"); // yellow
    expect(svg).not.toContain("#4c1"); // not green
  });

  it("failing status → red SVG", () => {
    writeFileSync(
      "changes/demo/receipt.json",
      JSON.stringify({
        ...stubbed(),
        status: "failing",
        tests: "0 passing",
        specSource: "1/1",
        hazards: "0 destructive patterns",
        coverage: "not measured",
      }),
      "utf8",
    );
    expect(deriveBadgeStatus(readReceipt("demo")!)).toBe("failing");
    expect(renderBadgeSvg(readReceipt("demo")!)).toContain("#e05d44");
  });

  it("coverage is NOT drawn on the badge when 'not measured'", () => {
    writeFileSync(
      "changes/demo/receipt.json",
      JSON.stringify({
        ...stubbed(),
        status: "partial",
        tests: "10 passing, 0 skipped",
        coverage: "not measured",
      }),
      "utf8",
    );
    const svg = renderBadgeSvg(readReceipt("demo")!);
    expect(svg.toLowerCase()).not.toContain("not measured");
    // but measured coverage IS shown
    writeFileSync(
      "changes/demo/receipt.json",
      JSON.stringify({
        ...stubbed(),
        status: "verified",
        tests: "10 passing",
        coverage: "81% lines (70% branches)",
      }),
      "utf8",
    );
    expect(renderBadgeSvg(readReceipt("demo")!)).toContain("81%");
  });

  it("fallback for pre-2.4 receipt without status: coverage not measured → partial", () => {
    const r = {
      ...stubbed(),
      tests: "10 passing, 0 skipped",
      coverage: "not measured",
      hazards: "0 destructive patterns",
    };
    expect(fallbackStatus(r)).toBe("partial");
    expect(deriveBadgeStatus(r)).toBe("partial");
  });

  it("fallback: explicit fail text in receipt → failing", () => {
    expect(
      fallbackStatus({
        ...stubbed(),
        tests: "FAIL  tests/x failed",
        coverage: "not measured",
      }),
    ).toBe("failing");
  });

  it("renderBadgeMarkdown prints a markdown snippet", () => {
    const md = renderBadgeMarkdown("demo");
    expect(md).toContain("demo");
    expect(md).toContain("badge.svg");
  });

  it("corrupt receipt.json → treated as not verified (reads null)", () => {
    writeFileSync("changes/demo/receipt.json", "{not json", "utf8");
    expect(readReceipt("demo")).toBeNull();
    expect(writeBadge("demo")!.status).toBe("not verified");
  });
});
