# Tasks — add-optional-token-auth-to-the-web-dashboard-so-that-binding-to-

- [x] [fact] Add `token?: string` and a loopback detector to `ServeOptions`/`startServer`; auto-generate a token when binding a non-loopback host without one
- [x] [fact] Enforce bearer token auth (Authorization: Bearer, x-orion-token header, or ?token= query) for every protected request, constant-time compared
- [x] [fact] Keep the default loopback bind (127.0.0.1) open/unauthenticated unless a --token is given (backward compatible)
- [x] [fact] Wire `--token` and `ORION_DASHBOARD_TOKEN` into the CLI `serve` command and surface the effective token to the operator
- [x] [fact] Make the dashboard UI work under token auth (append the token to its API fetches)
- [x] [fact] Cover auth behaviour with tests (no-auth loopback, token required, wrong token → 401, auto-token on non-loopback, UI fetches carry token)
