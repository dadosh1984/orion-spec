import { randomBytes } from "node:crypto";

/**
 * Crypto utilities (v0.46).
 *
 * Generate a random 32-char bearer token.
 *
 * v0.23: switched from Math.random() to a CSPRNG (node:crypto builtin, zero
 * new dependencies). Math.random()'s V8 state is recoverable from a few
 * outputs, and this token is the only auth on a non-loopback bind — a
 * predictable dashboard token defeats the whole point of auto-auth.
 */
export function generateToken(): string {
  return randomBytes(24).toString("base64url"); // 24 bytes -> 32 url-safe chars
}
