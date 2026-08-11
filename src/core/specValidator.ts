/**
 * Spec-driven output validation (v0.39) — проверяет результат скрипта
 * на соответствие JSON Schema без LLM. Zero-dependency: проходит по
 * ключам первого уровня, проверяет required-поля и типы.
 *
 * В production замените на AJV для полной поддержки JSON Schema draft-07.
 */
export interface OutputSpec {
  /** Обязательные поля в JSON-результате. */
  required?: string[];
  /** Типы полей (только первый уровень). */
  properties?: Record<string, { type: string }>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Проверить stdout на соответствие outputSchema из manifest-а скрипта. */
export function validateOutput(stdout: string, spec?: OutputSpec): ValidationResult {
  const errors: string[] = [];

  if (!spec) return { ok: true, errors: [] };

  // Пробуем распарсить JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return { ok: false, errors: ["stdout is not valid JSON"] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ["stdout must be a JSON object"] };
  }

  const obj = parsed as Record<string, unknown>;

  // Проверяем required поля
  for (const key of spec.required ?? []) {
    if (!(key in obj)) {
      errors.push(`missing required field: "${key}"`);
    }
  }

  // Проверяем типы
  for (const [key, prop] of Object.entries(spec.properties ?? {})) {
    if (key in obj) {
      const val = obj[key];
      const expected = prop.type;
      const actual = Array.isArray(val) ? "array" : typeof val;
      if (actual !== expected) {
        errors.push(`field "${key}": expected ${expected}, got ${actual}`);
      }
    }
  }

  // Проверяем поле status если есть
  if ("status" in obj) {
    const valid = ["success", "error", "needs_ai", "needs_human", "partial_success"];
    if (!valid.includes(obj.status as string)) {
      errors.push(`unknown status: "${obj.status}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
