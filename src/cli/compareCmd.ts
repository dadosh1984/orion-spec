import { changeStatus, phaseOf } from "../core/changeStatus.js";
import { statusMark } from "../utils/term.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readTasks } from "../skills/forge/handler.js";

/**
 * `orion compare <a> <b>` (v0.33) — side-by-side summary of two changes:
 * phase, task progress, guard verdict and artifact completeness. Deterministic
 * and zero-LLM; reads the same signals `list`/`status` use.
 */
export function compareCmd(
  a: string,
  b: string,
): { ok: boolean; text: string } {
  const missing = [a, b].filter(
    (id) => !existsSync(join("changes", id, "proposal.json")),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      text: `${statusMark("error")} not found under changes/: ${missing.join(", ")}`,
    };
  }
  const render = (id: string): string[] => {
    const st = changeStatus(id);
    const done = (st.done as number) ?? 0;
    const total = (st.tasks as number) ?? 0;
    const ratio = total > 0 ? done / total : 0;
    const guard =
      st.artifacts && (st.artifacts as Record<string, boolean>).guard;
    const guardTxt = guard ? "run" : "none";
    // Honest Receipt if present — compare how honestly the two approaches
    // verified their result (verified / partial / failing), the honesty
    // backbone, not just task counts.
    let receiptLine = "    receipt:   not run";
    try {
      const f = join("changes", id, "receipt.json");
      if (existsSync(f)) {
        const r = JSON.parse(readFileSync(f, "utf8")) as {
          status?: string;
          tests?: string;
          coverage?: string;
        };
        receiptLine = `    receipt:   ${r.status ?? "unknown"} — ${r.tests ?? "-"}${r.coverage && r.coverage !== "not measured" ? ` · ${r.coverage}` : ""}`;
      }
    } catch {
      /* corrupt receipt → show honest not-run */
    }
    return [
      `  ${id}`,
      `    phase:     ${phaseOf(id)}`,
      `    tasks:     ${done}/${total} (${Math.round(ratio * 100)}%)`,
      `    guard:     ${guardTxt}`,
      `    result:    ${st.artifacts && (st.artifacts as Record<string, boolean>).result ? "yes" : "no"}`,
      receiptLine,
    ];
  };
  const text = [
    `${statusMark("info")} Compare: ${a}  vs  ${b}`,
    ...render(a),
    ...render(b),
  ].join("\n");
  return { ok: true, text };
}

/** `orion assumptions <change>` (v0.33) — list the tasks draft marked as
 * [assumption] (things Orion inferred, not stated in the proposal). Honest:
 * assumptions are guesses and must be visible, not silent. */
export function assumptionsCmd(id: string): { ok: boolean; text: string } {
  if (!existsSync(join("changes", id, "proposal.json"))) {
    return {
      ok: false,
      text: `${statusMark("error")} change "${id}" not found`,
    };
  }
  const tasks = readTasks(id).filter((t) => /^\[assumption\]/.test(t.text));
  if (tasks.length === 0) {
    return {
      ok: true,
      text: `${statusMark("info")} No [assumption] tasks in "${id}" — everything is stated in the proposal.`,
    };
  }
  const text = [
    `${statusMark("warn")} Assumptions in "${id}" (draft's inferences — verify them):`,
    ...tasks.map((t) => `  • ${t.text.replace(/^\[assumption\]\s*/, "")}`),
  ].join("\n");
  return { ok: true, text };
}
