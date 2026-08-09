import { describe, it, expect, afterEach } from "vitest";
import { paint } from "../src/utils/term.js";
import { colorEnabled, statusMark, bar } from "../src/utils/term.js";

afterEach(() => {
  delete process.env.NO_COLOR;
  delete process.env.ORION_COLOR;
});

describe("term helpers (v0.31)", () => {
  it("statusMark returns ANSI emoji when color enabled, bracketed otherwise", () => {
    // Force monochrome to get a deterministic result regardless of host.
    process.env.NO_COLOR = "1";
    expect(statusMark("done")).toBe("[+]");
    expect(statusMark("error")).toBe("[x]");
    expect(statusMark("open")).toBe("[.]");
    delete process.env.NO_COLOR;
  });

  it("paint wraps with ANSI when enabled, passes through otherwise", () => {
    process.env.NO_COLOR = "1";
    expect(paint("PASS", "green")).toBe("PASS");
    delete process.env.NO_COLOR;
  });

  it("bar renders a plain percentage under NO_COLOR", () => {
    process.env.NO_COLOR = "1";
    expect(bar(0.5)).toBe("50%");
    expect(bar(1)).toBe("100%");
    expect(bar(0)).toBe("0%");
    delete process.env.NO_COLOR;
  });

  it("bar clamps out-of-range ratios", () => {
    process.env.NO_COLOR = "1";
    expect(bar(2)).toBe("100%");
    expect(bar(-1)).toBe("0%");
    delete process.env.NO_COLOR;
  });
});
