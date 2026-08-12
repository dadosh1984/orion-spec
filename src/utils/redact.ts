/**
 * Value redaction (v0.46).
 *
 * Secret-looking tokens that must not be echoed back by the dashboard
 * (v0.23). Deliberately conservative — a cache entry is user data, so a
 * value that carries a credential-shaped string is redacted wholesale.
 */
const SECRET_RE =
  /(api[_-]?key|secret|passwd|password|token|private[_-]?key|authorization|bearer)["']?\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}["']?/gi;

/** Replace credential-shaped matches with a short, honest marker. */
export function redactValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!value.match(SECRET_RE)) return value;
  return value.replace(
    SECRET_RE,
    (m) => `[redacted ${m.slice(0, 12)}… (${m.length} chars)]`,
  );
}
