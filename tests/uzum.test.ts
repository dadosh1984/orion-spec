import { describe, it, expect } from "vitest";
import { parsePriceBlock } from "../src/core/uzum.js";

describe("uzum price parser (v0.50)", () => {
  it("extracts the lowest full price, ignoring installments", () => {
    const line =
      "51 510 57 230 140 000 4 053 сум/мес Стало дешевле Фотиманинг боласи";
    expect(parsePriceBlock(line)).toBe(51510);
  });

  it("ignores monthly 'сум/мес' payments entirely", () => {
    // Only the installment present → null (no real full price to report).
    const line = "4 053 сум/мес Фотиманинг боласи";
    expect(parsePriceBlock(line)).toBe(null);
  });

  it("handles a plain single price", () => {
    expect(parsePriceBlock("70 000 Книга Фотиманинг боласи")).toBe(70000);
  });

  it("rejects implausibly tiny/huge numbers (reviews, badges)", () => {
    expect(parsePriceBlock("5.0 (32 отзыва) 51 510")).toBe(51510);
  });

  it("picks the minimum among several real prices", () => {
    const line = "98 000 100 000 7 083 сум/мес Фотиманинг боласи";
    expect(parsePriceBlock(line)).toBe(98000);
  });

  it("handles non-breaking-space thousands separators", () => {
    // \u00a0 instead of a plain space.
    const line = "51\u00a0510 57\u00a0230 4\u00a0053 сум/мес";
    expect(parsePriceBlock(line)).toBe(51510);
  });
});
