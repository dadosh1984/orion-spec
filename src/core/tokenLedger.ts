/**
 * Token Ledger (v0.41) — учёт токенов и ROI навыков.
 *
 * Каждый запуск `orion run` записывает TokenEvent.
 * skillMetrics агрегирует статистику по каждому навыку.
 *
 * Леджер хранится в ~/.orion/token-events.json + ~/.orion/skill-metrics.json.
 * Никаких внешних зависимостей.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface TokenEvent {
  id: string;
  ts: string;
  skillName: string;
  /** "run" | "create" | "repair" | "direct_ai" */
  mode: "run" | "create" | "repair" | "direct_ai";
  /** Токены, потраченные на этот вызов (0 для run без LLM). */
  tokensIn: number;
  /** Токены, сэкономленные по сравнению с прямым LLM-запуском. */
  tokensSaved: number;
  /** Оценочная стоимость прямого LLM-запуска в токенах. */
  baselineTokens: number;
  /** success | error | hazard_blocked | validation_failed */
  status: "success" | "error" | "hazard_blocked" | "validation_failed";
  durationMs: number;
}

export interface SkillMetric {
  skillName: string;
  runs: number;
  successRuns: number;
  failedRuns: number;
  /** Токены, потраченные на создание навыка. */
  creationTokens: number;
  /** Токены, потраченные на ремонт. */
  repairTokens: number;
  /** Средняя экономия токенов за один запуск. */
  avgTokensSavedPerRun: number;
  /** Общая экономия токенов. */
  totalTokensSaved: number;
  /** Чистая экономия (сэкономлено − создание − ремонт). */
  netTokensSaved: number;
  /** ROI: netTokensSaved / (creationTokens + repairTokens). */
  roiScore: number;
  lastUsedAt: string;
}

const MAX_EVENTS = 1000;

function ledgerDir(): string {
  return process.env.ORION_LEDGER_DIR ?? join(homedir(), ".orion");
}

function eventsPath(): string {
  return join(ledgerDir(), "token-events.json");
}

function metricsPath(): string {
  return join(ledgerDir(), "skill-metrics.json");
}

function readEvents(): TokenEvent[] {
  try {
    const p = eventsPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as TokenEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: TokenEvent[]): void {
  const dir = ledgerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    eventsPath(),
    JSON.stringify(events.slice(-MAX_EVENTS), null, 2),
    "utf8",
  );
}

function readMetrics(): SkillMetric[] {
  try {
    const p = metricsPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as SkillMetric[];
  } catch {
    return [];
  }
}

function writeMetrics(metrics: SkillMetric[]): void {
  const dir = ledgerDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(metricsPath(), JSON.stringify(metrics, null, 2), "utf8");
}

/** Записать одно событие. */
export function recordTokenEvent(event: Omit<TokenEvent, "id" | "ts">): void {
  const events = readEvents();
  events.push({
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
  });
  writeEvents(events);
}

/** Обновить метрики навыка после запуска. */
export function updateSkillMetrics(
  skillName: string,
  run: {
    success: boolean;
    tokensSaved: number;
    durationMs: number;
    mode: TokenEvent["mode"];
    tokensIn: number;
  },
): SkillMetric {
  const metrics = readMetrics();
  let m = metrics.find((x) => x.skillName === skillName);
  if (!m) {
    m = {
      skillName,
      runs: 0,
      successRuns: 0,
      failedRuns: 0,
      creationTokens: 0,
      repairTokens: 0,
      avgTokensSavedPerRun: 0,
      totalTokensSaved: 0,
      netTokensSaved: 0,
      roiScore: 0,
      lastUsedAt: "",
    };
    metrics.push(m);
  }

  m.runs++;
  if (run.success) m.successRuns++;
  else m.failedRuns++;

  if (run.mode === "create") m.creationTokens += run.tokensIn;
  if (run.mode === "repair") m.repairTokens += run.tokensIn;

  m.totalTokensSaved += run.tokensSaved;
  m.netTokensSaved = m.totalTokensSaved - m.creationTokens - m.repairTokens;
  m.avgTokensSavedPerRun =
    m.runs > 0 ? Math.round(m.totalTokensSaved / m.runs) : 0;
  m.roiScore =
    m.creationTokens + m.repairTokens > 0
      ? Math.round((m.netTokensSaved / (m.creationTokens + m.repairTokens)) * 100) / 100
      : m.totalTokensSaved > 0
        ? Infinity
        : 0;
  m.lastUsedAt = new Date().toISOString();

  writeMetrics(metrics);
  return m;
}

/** Получить метрики всех навыков. */
export function getSkillMetrics(): SkillMetric[] {
  return readMetrics().sort((a, b) => b.totalTokensSaved - a.totalTokensSaved);
}

/** Получить метрики одного навыка. */
export function getSkillMetric(name: string): SkillMetric | null {
  return readMetrics().find((m) => m.skillName === name) ?? null;
}

/** Последние N событий. */
export function getRecentEvents(n = 20): TokenEvent[] {
  return readEvents().slice(-n).reverse();
}

/** Суммарная статистика. */
export function tokenSummary(): {
  totalEvents: number;
  totalSaved: number;
  totalRuns: number;
  skillCount: number;
} {
  const events = readEvents();
  const metrics = readMetrics();
  return {
    totalEvents: events.length,
    totalSaved: metrics.reduce((s, m) => s + m.totalTokensSaved, 0),
    totalRuns: metrics.reduce((s, m) => s + m.runs, 0),
    skillCount: metrics.length,
  };
}

/** Базовая оценка токенов для прямого LLM-запуска (эвристика). */
export function estimateBaselineTokens(promptLength: number): number {
  // ~1 токен на 4 символа для system + user + response
  const systemOverhead = 200;
  const responseOverhead = 300;
  return systemOverhead + Math.ceil(promptLength / 4) + responseOverhead;
}
