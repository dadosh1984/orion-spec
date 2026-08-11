import { statusMark } from "../utils/term.js";

/** `orion env` (v0.38) — show all ORION_* environment variables. */
export function envCmd(): { ok: boolean; text: string } {
  const vars = Object.keys(process.env)
    .filter((k) => k.startsWith("ORION_"))
    .sort();

  if (vars.length === 0) {
    return {
      ok: true,
      text: `${statusMark("info")} No ORION_* environment variables set.`,
    };
  }

  const SECRET_KEYS = /(TOKEN|SECRET|KEY|PASSWORD)$/i;
  const maxLen = Math.max(...vars.map((k) => k.length));
  const lines = [
    `${statusMark("info")} Orion environment (${vars.length} variable(s)):`,
    "",
  ];

  for (const k of vars) {
    const raw = process.env[k] ?? "";
    const display = SECRET_KEYS.test(k)
      ? `${raw.slice(0, 4)}…${raw.slice(-4)} (masked)`
      : raw || "(empty)";
    lines.push(`  ${k.padEnd(maxLen)} = ${display}`);
  }

  return { ok: true, text: lines.join("\n") };
}
