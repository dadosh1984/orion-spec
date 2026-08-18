import { describe, it, expect } from "vitest";
import {
  parsePhone,
  validatePhone,
  formatPhone,
} from "../src/core/phoneValidator.js";

describe("parsePhone", () => {
  it("parses +1 US 10-digit number", () => {
    const p = parsePhone("+14155552671");
    expect(p.countryCode).toBe("141");
    expect(p.nationalNumber).toBe("55552671");
    expect(p.raw).toBe("+14155552671");
  });

  it("parses +44 UK number", () => {
    const p = parsePhone("+442071234567");
    expect(p.countryCode).toBe("442");
    expect(p.nationalNumber).toBe("071234567");
  });

  it("parses +998 UZ number", () => {
    const p = parsePhone("+998901234567");
    expect(p.countryCode).toBe("998");
    expect(p.nationalNumber).toBe("901234567");
  });

  it("accepts 7-digit minimum", () => {
    const p = parsePhone("+1234567");
    expect(p.countryCode).toBe("123");
    expect(p.nationalNumber).toBe("4567");
  });

  it("accepts 15-digit maximum", () => {
    const p = parsePhone("+123456789012345");
    expect(p.countryCode).toBe("123");
    expect(p.nationalNumber).toBe("456789012345");
  });

  it("rejects empty input", () => {
    expect(() => parsePhone("")).toThrow("Invalid input");
  });

  it("rejects non-string input", () => {
    expect(() => parsePhone(42 as unknown as string)).toThrow("Invalid input");
  });

  it("rejects missing + prefix", () => {
    expect(() => parsePhone("14155552671")).toThrow("Must start with +");
  });

  it("rejects letters after +", () => {
    expect(() => parsePhone("+1A2B3C")).toThrow("Digits only after +");
  });

  it("rejects too short (6 digits)", () => {
    expect(() => parsePhone("+123456")).toThrow("Invalid length");
  });

  it("rejects too long (16 digits)", () => {
    expect(() => parsePhone("+1234567890123456")).toThrow("Invalid length");
  });
});

describe("validatePhone", () => {
  it("returns ok for valid US number", () => {
    const r = validatePhone("+14155552671");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.phone.countryCode).toBe("141");
  });

  it("returns ok=false for missing +", () => {
    const r = validatePhone("14155552671");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Must start with +");
  });

  it("returns ok=false for too-short national number", () => {
    const r = validatePhone("+1234567"); // national = "4567" (4 digits, ok)
    expect(r.ok).toBe(true);
    const r2 = validatePhone("+123456"); // 6 digits total → parse throws
    expect(r2.ok).toBe(false);
  });

  it("returns ok=false for too-long national number", () => {
    // 15 digits total, national = 12 digits → ok
    const r = validatePhone("+123456789012345");
    expect(r.ok).toBe(true);
    // 16 digits total → parse throws
    const r2 = validatePhone("+1234567890123456");
    expect(r2.ok).toBe(false);
  });
});

describe("formatPhone", () => {
  it("formats US number", () => {
    const p = parsePhone("+14155552671");
    expect(formatPhone(p)).toBe("+141 555 526 71");
  });

  it("formats UK number", () => {
    const p = parsePhone("+442071234567");
    expect(formatPhone(p)).toBe("+442 071 234 567");
  });

  it("formats minimum 7-digit number", () => {
    const p = parsePhone("+1234567");
    expect(formatPhone(p)).toBe("+123 456 7");
  });
});
