# Security

**Orion is a young project** (first release 2026-08-06) with a deliberately
small surface. This page states honestly what is in scope, what we treat as
sensitive, and how to report a problem.

## Scope

- Orion is a **zero-dependency, local CLI toolkit**. It does not run a
  network service except the optional dashboard (`orion serve`), which
  binds to `127.0.0.1` by default.
- It executes the commands your project already uses (`eslint`, `tsc`,
  `vitest`, `prettier`, …) as subprocesses. Its own sandboxing is
  behavioral, not a security boundary.
- No telemetry, no network calls, no update checks. State lives in local
  files (`~/.orion/`, `coverage/`, `changes/`, `reports/`).

## What we treat as sensitive

- **Dashboard auth token** — `orion serve --token T` (or
  `ORION_DASHBOARD_TOKEN`). With a token set, every API call must carry it
  as `?token=…`, `Authorization: Bearer`, or `x-orion-token`. Without a
  token, loopback binds (`127.0.0.1`, the default) run unauthenticated —
  that is by design for a local-machine dashboard — while a non-loopback
  bind auto-generates a token and prints it to stdout so an exposed
  dashboard is never unauthenticated. Treat a printed token like a
  password (it grants read access to cache/ledger stats on the bound
  port).
- The token-economy and lessons ledgers contain command outputs and error
  messages from your own projects — keep them out of public repos if they
  contain sensitive paths or snippets.

## Known limitations

- `shield`'s security scan looks for obvious patterns (`eval`, `new
  Function`, `child_process`, `process.env.*`) — it is a heuristic lint,
  not a vulnerability scanner, and can produce false negatives.
- `orion verify` is an evidence pass ("signal, never a gate") and is not a
  correctness guarantee.
- The Docker image runs the CLI as the non-root `node` user; when the
  workspace is mounted from the host, pass `--user "$(id -u):$(id -g)"` so
  file ownership stays sensible.

## Reporting

- Prefer a **GitHub issue** with a minimal reproducer (the exact command
  and inputs) so it can be fixed in the open.
- For anything you believe should not be public yet (e.g. an exploitable
  issue in the dashboard auth), open an issue with `[security]` in the
  title and redact credentials/tokens before posting; there is no private
  channel — assume everything you write is public.
- We will acknowledge and fix issues as fast as a small project can. There
  is no bug bounty.
