/**
 * E.164 phone number parser, validator, and formatter (v0.67).
 *
 * Structural validation only — checks format and length per ITU-T E.164.
 * Does not check whether the country code is assigned or whether the
 * number is currently in use (that requires a network lookup).
 *
 * Zero runtime dependencies.
 */

/** A parsed E.164 phone number. */
export interface PhoneNumber {
  /** 3-digit country code (E.164 allows 1–3 digits; we pin 3 for determinism). */
  readonly countryCode: string;
  /** Remaining digits (national significant number). */
  readonly nationalNumber: string;
  /** Original input, trimmed. */
  readonly raw: string;
}

/** Throws on malformed input. */
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

/** Non-throwing variant: always returns a discriminated result. */
export type ValidateResult =
  { ok: true; phone: PhoneNumber } | { ok: false; error: string };

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

/** Format as "+XXX NNN NNN NN…" — groups of 3 after the country code. */
export function formatPhone(p: PhoneNumber): string {
  const groups = ["+" + p.countryCode];
  let remaining = p.nationalNumber;
  while (remaining.length > 0) {
    groups.push(remaining.slice(0, 3));
    remaining = remaining.slice(3);
  }
  return groups.join(" ");
}
