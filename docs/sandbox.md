# Sandboxed CI (v0.4)

Orion ships as a Docker image so the agent can execute inside an isolated,
network‑disabled container instead of directly on your machine.

## Build

```bash
docker build -t orion:0.4 .
```

The build is multi‑stage:

| Stage | Contents |
|---|---|
| `builder` | full dev toolchain (typescript, vitest, eslint…) — compiles `src/` → `dist/` |
| `runtime` | only `dist/`, `src/config/` and `package.json` — no devDependencies |

The runtime image is `node:22-alpine` and the CLI is the container entrypoint,
so every `docker run orion …` is equivalent to `orion …`.

## Run (sandboxed)

```bash
# shield a change without network access, mounting the current project
docker run --rm --network none \
  -v "$PWD":/workspace \
  -v orion-cache:/root/.orion \
  orion:0.4 shield my-change

# or with Docker Compose
docker compose run --rm orion track status
```

What the sandbox guarantees:

- `--network none` — the agent cannot reach the network
- the **only** path mounted is your project (`/workspace`) plus the cache volume
- no host sockets, no host environment, no rootful docker API inside

The cache volume (`orion-cache`) persists between runs so the token‑economy
cache survives container restarts:

```bash
docker run --rm --network none \
  -v "$PWD":/workspace -v orion-cache:/root/.orion \
  orion:0.4 track status
```

## CI integration

`.github/workflows/ci.yml` builds the image on every push (step `Build Docker
image`) — this catches Dockerfile regressions without pushing to a registry.
