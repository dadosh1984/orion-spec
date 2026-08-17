/**
 * Spec-driven output validation (v0.39) — validates the script's result
 * against the JSON Schema without LLM. Zero-dependency: walks the first-level
 * keys, checks required fields and types.
 *
 * In production, swap in AJV for full JSON Schema draft-07 support.
 */
export interface OutputSpec {
  /** Required fields in the JSON result. */
  required?: string[];
  /** Field types (first level only). */
  properties?: Record<string, { type: string }>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate stdout against the outputSchema from the script manifest. */
export function validateOutput(
  stdout: string,
  spec?: OutputSpec,
): ValidationResult {
  const errors: string[] = [];

  if (!spec) return { ok: true, errors: [] };

  // Try to parse JSON
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

  // Check required fields
  for (const key of spec.required ?? []) {
    if (!(key in obj)) {
      errors.push(`missing required field: "${key}"`);
    }
  }

  // Check types
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

  // Check the status field if present
  if ("status" in obj) {
    const valid = [
      "success",
      "error",
      "needs_ai",
      "needs_human",
      "partial_success",
    ];
    if (!valid.includes(obj.status as string)) {
      errors.push(`unknown status: "${obj.status}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
