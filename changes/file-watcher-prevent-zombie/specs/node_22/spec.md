# Spec: node_22

## Purpose
File watcher — prevent zombie child processes. In `runCmd.ts`, the `watch start` spawns a detached process with `child.unref()` and no PID tracking. Fix: write the child PID to the watcher manifest (or a `.watcher-<name>.pid` file), add `process.on('exit', cleanup)` to kill the child on parent exit, and `removeFileWatcher` (watch stop) should read the PID file and kill the process. Also validate that the child actually started (check `child.pid` exists after spawn).

## Scope

- In scope: the capability above, delivered test-first.
- Out of scope: anything not stated in the proposal.

## Acceptance criteria
- [ ] Placeholder — refine during implementation
