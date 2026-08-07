# ============================================================================
# Orion v0.4 — sandboxed CI image
#
# Multi-stage build:
#   1. builder — installs devDependencies and compiles TypeScript -> dist/
#   2. runtime  — minimal image with only dist/ + config + package.json
#
# Usage (sandboxed CI):
#   docker build -t orion:0.4 .
#   docker run --rm --network none \
#     -v "$PWD":/workspace \
#     -v orion-cache:/home/node/.orion \
#     --user "$(id -u):$(id -g)" \   # workspace is host-owned; see below
#     orion:0.4 shield my-change
#
# The runtime runs as the non-root `node` user. The /workspace volume is
# mounted from the host, so when it is owned by your host uid, pass
# `--user "$(id -u):$(id -g)"` (or chown the directory) so Orion can write
# reports/ and changes/ inside it.
# ============================================================================
FROM node:22-alpine AS builder

# Pin pnpm to the exact version declared in package.json#packageManager
RUN npm install -g pnpm@11.18.0

WORKDIR /workspace

# Layer-friendly dependency install (lockfile is the source of truth)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Compile src/ -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /workspace

# Only the compiled CLI, its runtime config and package metadata are shipped
COPY --from=builder /workspace/dist ./dist
COPY --from=builder /workspace/src/config ./src/config
COPY --from=builder /workspace/package.json ./

ENV NODE_ENV=production

# Run as non-root (the node image defines the `node` user; HOME=/home/node)
USER node

# Every `docker run orion ...` becomes `orion ...`
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["help"]
