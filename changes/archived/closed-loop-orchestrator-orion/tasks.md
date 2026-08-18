# Tasks — closed-loop-orchestrator-orion

## T1: autopilot.ts core — decision algorithm + bounded loop
- `src/core/autopilot.ts`: `runAutopilot(opts)` with clear decision algorithm: next → repair → think → shield → out. Hard cap MAX_ITER (default 5) + token budget (reuse budget.ts).
- Honest stops: loopDetected, budgetExceeded, MAX_ITER exhaustion — all reported, no infinite loop.
- Trace every action via telemetry.trace (action, reason, tokenCost).
- On success: markRepairFixed + recordLesson success pattern; on clean change → no-op.

## T2: status/next integration
- Use nextStep() from next/handler.ts (returns selfCorrection/loopDetected/budgetExceeded).
- Route: when nextStep.selfCorrection → call think() with correctivePrompt (bounded). When loopDetected/budgetExceeded → stop honestly.

## T3: repair integration
- When a skill script errors (runScript resumed from runtime/repair), autopilot runs `orion run repair <name> --auto` reforge loop, closes markRepairFixed on success.

## T4: CLI entry
- `orion autopilot` — run the closed loop. Human + JSON summary. Print decision trace.

## T5: wire into `orion new --pipeline`
- After shield FAIL → autopilot takes over (bounded), instead of just erroring out.

## T6: tests
- autopilot routes failing change through selfCorrection bounded by MAX_ITER
- stops on loopDetected, budgetExceeded, exhaustion (honest, no infinite loop)
- clean change → no-op
- closes repair attempts on success + records success pattern
