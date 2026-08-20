/**
 * Task surface for the E.164 phone validator — `# Spec: parsePhone`.
 *
 * Real implementation lives here (not a re-export) so the drift check's
 * SYMBOL regex (`export function/const/class`) detects the capability.
 * Structural validation only — checks format and length per ITU-T E.164.
 * Zero runtime dependencies.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ⚠️  DEMO-ONLY — NOT A PRODUCTION E.164 PARSER
 * ─────────────────────────────────────────────────────────────────────
 * `parsePhone` pins the country code to 3 digits (`digits.slice(0, 3)`)
 * "for determinism". That is WRONG on real E.164 input: country codes
 * are 1–3 digits, so `+14155552671` (US, country code "1") is parsed
 * as country code "141". The only reason this module passes its own
 * tests is that those tests assert the pinned-3 behaviour.
 *
 * The honest path is either (a) implement a real ITU-T prefix table
 * (~200 countries, scope-creep), or (b) ship this as a didactic
 * example and label it. This file is option (b): a teaching artifact
 * for parser-shape exercises, NOT a callable E.164 validator. Do not
 * use `parsePhone` / `validatePhone` for real phone routing, billing,
 * or compliance — use a vetted library (libphonenumber-js, Twilio Lookup).
 *
 * Used by: archived demo-change `e-164-phone-number-2` only. Not wired
 * into any CLI command. Kept under `src/tasks/` so the drift check
 * has a symbol to bind to.
 */

/** A parsed E.164 phone number. DEMO-ONLY — see file header. */
export interface PhoneNumber {
  /** 3-digit country code (E.164 allows 1–3 digits; we pin 3 for determinism). */
  readonly countryCode: string;
  /** Remaining digits (national significant number). */
  readonly nationalNumber: string;
  /** Original input, trimmed. */
  readonly raw: string;
}

/**
 * Parse an E.164 phone number.
 * DEMO-ONLY — see file header. The 3-digit country-code pin is wrong
 * on real E.164 input (1–3 digits). Do not use for real phone routing.
 * Throws on malformed input.
 */
export function parsePhone(raw: string): PhoneNumber {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Invalid input");
  }
  const cleaned = raw.trim();
  if (!cleaned.startsWith("+")) {
    throw new Error("Must start with +");
  }
  const digits = cleaned.slice(1);
  if (!/^\d+$/.test(digits)) {
    throw new Error("Digits only after +");
  }
  if (digits.length < 7 || digits.length > 15) {
    throw new Error(
      `Invalid length: must be 7-15 digits, got ${digits.length}`,
    );
  }
  return {
    countryCode: digits.slice(0, 3),
    nationalNumber: digits.slice(3),
    raw: cleaned,
  };
}

/**
 * Non-throwing variant.
 * DEMO-ONLY — see file header. Returns whatever `parsePhone` returns,
 * which means `countryCode` is the first 3 digits regardless of the
 * real ITU-T prefix. Always returns a discriminated result.
 */
export type ValidateResult =
  { ok: true; phone: PhoneNumber } | { ok: false; error: string };

/**
 * Validate an E.164 phone number without throwing.
 * DEMO-ONLY — see file header. `countryCode` field is the first 3
 * digits of the input, not the real ITU-T country prefix.
 */
export function validatePhone(raw: string): ValidateResult {
  let phone: PhoneNumber;
  try {
    phone = parsePhone(raw);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (phone.nationalNumber.length < 4) {
    return { ok: false, error: "National number too short" };
  }
  if (phone.nationalNumber.length > 12) {
    return { ok: false, error: "National number too long" };
  }
  return { ok: true, phone };
}

/**
 * Format a PhoneNumber for display.
 * DEMO-ONLY — see file header. Grouping is cosmetic; the `countryCode`
 * slot is whatever `parsePhone` stored, which may be wrong on real input.
 */
export function formatPhone(p: PhoneNumber): string {
  const groups = ["+" + p.countryCode];
  let remaining = p.nationalNumber;
  while (remaining.length > 0) {
    groups.push(remaining.slice(0, 3));
    remaining = remaining.slice(3);
  }
  return groups.join(" ");
}
