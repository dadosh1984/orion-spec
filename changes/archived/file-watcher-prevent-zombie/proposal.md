# Proposal — file-watcher-prevent-zombie

## Goal
File watcher — prevent zombie child processes. In `runCmd.ts`, the `watch start` spawns a detached process with `child.unref()` and no PID tracking. Fix: write the child PID to the watcher manifest (or a `.watcher-<name>.pid` file), add `process.on('exit', cleanup)` to kill the child on parent exit, and `removeFileWatcher` (watch stop) should read the PID file and kill the process. Also validate that the child actually started (check `child.pid` exists after spawn).

## Context

| Aspect | Value |
|--------|-------|
| Platform | node 22+ |
| Budget | compact |
| Constraints | zero-dependency; write PID to ~/.orion/watchers/<name>.pid; cleanup on SIGTERM/SIGINT; edit src/cli/runCmd.ts + src/core/router.ts |

- **Lessons applied (v0.12):** фаза-10-прямая-запись:shield:419cdebf38b1, migrate-tool-e2e-pipeline:shield:7fa3ad4497fa, orion-spec:session:1546e29f7205, mcp-сервер-cli-onec:shield:fd51e5a0ce4b, orion-spec:session:6b4cf54ad029
