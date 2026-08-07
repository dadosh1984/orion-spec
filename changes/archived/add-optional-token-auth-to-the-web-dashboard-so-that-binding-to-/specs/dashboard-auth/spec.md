# Spec: dashboard-auth

## Purpose
Optionally protect the `orion serve` web dashboard with a bearer token, so
binding to a non-loopback host never exposes cache statistics and change
lists without a password.

## Acceptance criteria
- `ServeOptions` gains a `token?: string`.
- When a token is set (or the bind host is non-loopback), every request is
  gated on it: `Authorization: Bearer <tok>`, `x-orion-token: <tok>`, or a
  `?token=` query. Comparisons are constant-time.
- A non-loopback bind with no explicit token auto-generates one (the
  effective token is surfaced to the operator) — an exposed dashboard is
  never left unauthenticated.
- The default loopback bind (127.0.0.1) stays open/unauthenticated unless a
  `--token` or `ORION_DASHBOARD_TOKEN` is supplied (backward compatible).
- The dashboard UI works under auth by reusing the page's `?token=` query on
  its API fetches.
- Unauthorized requests get `401` with `WWW-Authenticate: Bearer`.
- The CLI accepts `--token <tok>` and surfaces the effective token.
