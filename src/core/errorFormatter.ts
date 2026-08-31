import errorCodes from "./errorCodes.json" with { type: "json" };
import { paint, statusMark } from "../utils/term.js";

export type ErrorCode = keyof typeof errorCodes;

export class OrionError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message);
    this.name = "OrionError";
  }
}

export function formatOrionError(code: ErrorCode, detail?: string): string {
  const meta = errorCodes[code];
  if (!meta) return `[${code}] ${detail ?? "Unknown error"}`;

  return [
    `${statusMark("error")} ${paint(`[${code}] ${meta.title}`, "red")}${detail ? `: ${detail}` : ""}`,
    `  ${paint("Решение:", "dim")} ${meta.solution}`,
    `  ${paint("Справка:", "dim")} ${meta.doc}`,
  ].join("\n");
}
