// === T5: driftCheck обобщение ===
// Обновление src/core/drift.ts для поддержки нескольких языков
// ponytail: rung-3 — detect adapter before drift check
// ponytail: rung-6 — python adapter may call external script

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:process" as pathJoin;
import { getAdapters, detectAdapter } from "../core/shield/adapter.js";

// Текущие функции taskSymbols() и driftOf() остаются,
// но добавляется обёртка для поддержки адаптеров.

/**
 * Drift check с поддержкой адаптера языка.
 * Если адаптер найден — использует его extractApi().
 * Если нет — использует старый TS-only путь.
 */
export function driftOf(changeId: string): boolean | null {
  const base = join("changes", changeId, "specs");
  if (!existsSync(base)) return null;

  // Собираем expected так же как сейчас
  let expected: string[] = [];
  // ... (та же логика сбора # Spec: заголовков)

  const adapter = detectAdapter(process.cwd());
  if (adapter) {
    // Используем адаптер для извлечения API
    const srcFiles = collectFiles("src", adapter.id === "python" ? ".py" : ".ts");
    const symbols = new Set(adapter.extractApi(srcFiles));
    return checkDrift(expected, symbols);
  }

  // Fallback: старая TS логика
  const symbols = taskSymbols();
  return checkDrift(expected, new Set(symbols));
}

function checkDrift(expected: string[], symbols: Set<string>): boolean | null {
  if (expected.length === 0) return null;
  return expected.every((cap) => symbols.has(cap)) ? true : false;
}

function collectFiles(dir: string, ext: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const walk = (d: string): void => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(ext)) out.push(p);
    }
  };
  walk(dir);
  return out;
}
