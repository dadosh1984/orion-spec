# Spec: runAutopilot

## Purpose
Closed-loop orchestrator that routes a failing change through Orion's own
self-improvement mechanisms automatically, bounded by iteration cap and
token budget, instead of requiring manual commands.

## Decision algorithm
- `nextStep` returns `selfCorrection` → `think()` with the corrective prompt
- `loopDetected` → stop honestly (repeating burns budget)
- `budgetExceeded` → stop honestly (spend cap)
- guard green + out SUCCESS → close loop, mark repair fixed, record success pattern
- clean change → no-op

## Scope
- In scope: automatic routing, honest bounded stops, telemetry trace.
- Out of scope: manual command sequences — autopilot replaces them.
