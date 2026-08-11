import { describe, it, expect } from "vitest";
import { classifyTask, type ClassifyResult } from "../src/core/classify.js";

describe("classifyTask", () => {
  function check(
    prompt: string,
    expectedCategory: number,
    expectedRecommendation: string,
  ): void {
    const r = classifyTask(prompt);
    expect(
      r.category,
      `"${prompt}" → category ${r.category}, expected ${expectedCategory}`,
    ).toBe(expectedCategory);
    expect(
      r.recommendation,
      `"${prompt}" → ${r.recommendation}, expected ${expectedRecommendation}`,
    ).toBe(expectedRecommendation);
  }

  // --- Category 1: детерминированные ---
  it("classifies backup as category 1 (RU)", () => {
    check("сделай бэкап папки Documents", 1, "script");
  });
  it("classifies cleanup as category 1 (EN)", () => {
    check("clean up my Downloads folder every day", 1, "script");
  });
  it("classifies file conversion as category 1", () => {
    check("конвертировать все CSV файлы в JSON", 1, "script");
  });
  it("classifies rename as category 1", () => {
    check("rename all PNG files by date", 1, "script");
  });

  // --- Category 2: с неопределённостью ---
  it("classifies log parsing as category 2 (RU)", () => {
    check("обработать логи сервера и найти ошибки", 2, "script_with_ai");
  });
  it("classifies data validation as category 2 (EN)", () => {
    check("validate all CSV files in this folder", 2, "script_with_ai");
  });
  it("classifies document extraction as category 2", () => {
    check("извлечь данные из PDF счетов", 2, "script_with_ai");
  });

  // --- Category 3: API/сеть ---
  it("classifies telegram notification as category 3 (RU)", () => {
    check("отправить уведомление в Telegram", 3, "script");
  });
  it("classifies API fetch as category 3 (EN)", () => {
    check("fetch exchange rates from the API daily", 3, "script");
  });
  it("classifies webhook as category 3", () => {
    check("send a webhook when backup completes", 3, "script");
  });

  // --- Category 4: динамичный веб ---
  it("classifies web scraping as category 4 (RU)", () => {
    check("спарсить сайт и извлечь статьи", 4, "script_with_ai");
  });
  it("classifies price monitoring as category 4 (EN)", () => {
    check("monitor the price of this product on Amazon", 4, "script_with_ai");
  });
  it("classifies form filling as category 4", () => {
    check("заполнить форму на сайте автоматически", 4, "script_with_ai");
  });

  // --- Category 5: творческие ---
  it("classifies contract analysis as category 5 (RU)", () => {
    check("проанализировать договор и найти риски", 5, "ai_only");
  });
  it("classifies text writing as category 5 (EN)", () => {
    check("write an article about AI safety", 5, "ai_only");
  });
  it("classifies creative brainstorming as category 5", () => {
    check("придумай 10 идей для стартапа", 5, "ai_only");
  });
  it("classifies comparison as category 5", () => {
    check("сравни эти два подхода к архитектуре", 5, "ai_only");
  });

  // --- Fallback: unknown → category 5 ---
  it("defaults to category 5 for unknown prompts", () => {
    const r = classifyTask("xyzzy foobar blarg");
    expect(r.category).toBe(5);
    expect(r.recommendation).toBe("ai_only");
  });
});
