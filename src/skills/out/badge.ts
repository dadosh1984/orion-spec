/**
 * SVG Badge (v0.52, task 2.4) — visibility layer of the honesty pyramid.
 *
 * A pure function OF the Honest Receipt, never a second source of truth:
 * reads `changes/<id>/receipt.json` (written by `out`), renders a
 * self-contained SVG (no external fonts/network), prints a markdown snippet
 * for README.
 *
 * Honesty contract (like the receipt): no `receipt.json` → grey "not
 * verified" (NOT green by default); deterministic — one receipt.json → the
 * SAME bytes of SVG; status comes from the receipt fields (no shield re-run).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ReceiptData } from "./receipt.js";

export type BadgeStatus = "verified" | "partial" | "failing" | "not verified";

/** Raw receipt on disk (may lack `status` for pre-v2.4 receipt.json). */
type StoredReceipt = Partial<ReceiptData> & Pick<ReceiptData, "change">;

/** Read the Honest Receipt, or null when the file is absent. */
export function readReceipt(changeId: string): StoredReceipt | null {
  const f = `changes/${changeId}/receipt.json`;
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as StoredReceipt;
  } catch {
    return null; // corrupt receipt = no verified-certificate either
  }
}

/**
 * Fallback status for receipts that predate the `status` field: derive
 * deterministically from the string fields (mirrors deriveStatus guard logic).
 */
export function fallbackStatus(
  r: StoredReceipt,
): Exclude<BadgeStatus, "not verified"> {
  const low = (s: unknown): string => String(s ?? "").toLowerCase();
  const cov = low(r.coverage);
  const tests = low(r.tests);
  const spec = low(r.specSource);
  const hazards = low(r.hazards);
  // Nothing was measured/known → not verified (no FAIL, but no PASS either).
  const allUnknown =
    (cov === "" || cov === "not measured") &&
    (tests === "" || tests === "not measured") &&
    /fail/i.test(tests) === false;
  if (
    allUnknown &&
    !/no obvious|0 destructive|0 \(scan passed\)/.test(hazards)
  ) {
    return "failing"; // no pass signal on the thin receipt
  }
  // Any explicit failure marker wins.
  if (
    /fail/i.test(tests) ||
    /fail/i.test(spec) ||
    /not match|missing/i.test(hazards)
  ) {
    return "failing";
  }
  // Everything clean but coverage unmeasured → partial (honest ceiling).
  if (cov === "not measured" || cov === "") return "partial";
  return "verified";
}

/** The final honest status: stored `status` when present, else fallback. */
export function deriveBadgeStatus(r: StoredReceipt): BadgeStatus {
  if (
    r.status === "verified" ||
    r.status === "partial" ||
    r.status === "failing"
  ) {
    return r.status;
  }
  return fallbackStatus(r);
}

const STATUS_COLOR: Record<BadgeStatus, string> = {
  verified: "#4c1", // green
  partial: "#dfb317", // yellow
  failing: "#e05d44", // red
  "not verified": "#9f9f9f", // grey
};

/** Compact stat string, omitting coverage when honestly "not measured". */
function statsLine(r: StoredReceipt): string {
  const parts: string[] = [];
  const tests = String(r.tests ?? "").match(/(\d+)\s+passing/);
  if (tests) parts.push(`tests ${tests[1]}`);
  const spec = String(r.specSource ?? "").match(/(\d+)\/(\d+) symbols matched/);
  if (spec) parts.push(`spec ${spec[1]}/${spec[2]}`);
  const hazards = String(r.hazards ?? "").match(
    /no obvious issues|0 destructive patterns|0 \(scan passed\)/,
  );
  if (hazards) parts.push("hazards 0");
  const cov = String(r.coverage ?? "");
  if (cov && cov !== "not measured") parts.push(cov);
  return parts.join(" · ");
}

/** Escape XML/HTML special chars so the SVG stays valid. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Approx text width (monospace, 8px at font-size 11). */
function textWidth(s: string): number {
  return Array.from(s).reduce(
    (w, ch) => w + (ch.codePointAt(0)! > 127 ? 12 : 8),
    0,
  );
}

/**
 * Render a self-contained flat SVG badge. Deterministic: no timestamps, no
 * randomness — the same (receipt, status) always yields identical bytes.
 * `null` (no receipt.json) renders the grey "not verified" badge.
 */
export function renderBadgeSvg(receipt: StoredReceipt | null): string {
  const status: BadgeStatus = receipt
    ? deriveBadgeStatus(receipt)
    : "not verified";
  const color = STATUS_COLOR[status];
  const label = "orion";
  const stats = receipt ? statsLine(receipt) : "";
  const value =
    status === "not verified"
      ? "not verified"
      : `${status}${stats ? ` · ${stats}` : ""}`;
  const font = "font-family='Verdana,DejaVu Sans,sans-serif'";

  const padX = 6;
  const labelW = textWidth(label) + padX * 2;
  const valueW = textWidth(value) + padX * 2;
  const total = labelW + valueW; // adaptive width, computed from text (deterministic)
  const valueTotal = valueW;
  const desc = esc(`${label} ${value}`);

  return [
    `<svg xmlns='http://www.w3.org/2000/svg' width='${total}' height='20' role='img' aria-label='${desc}'>`,
    `<title>${desc}</title>`,
    `<rect width='${labelW}' height='20' fill='#555'/>`,
    `<rect x='${labelW}' width='${valueTotal}' height='20' fill='${color}'/>`,
    `<g shape-rendering='crispEdges'>`,
    `<rect width='${labelW}' height='20' fill='#555'/>`,
    `<rect x='${labelW}' width='${valueTotal}' height='20' fill='${color}'/>`,
    `</g>`,
    `<g fill='#fff' text-anchor='middle' ${font} font-size='11'>`,
    `<text x='${Math.round(labelW / 2)}' y='15'>${esc(label)}</text>`,
    `<text x='${Math.round(labelW + valueTotal / 2)}' y='15'>${esc(value)}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

/** Print badge fallback README snippet (always safe: uses shields-like link). */
export function renderBadgeMarkdown(changeId: string): string {
  return [
    `**Change status** — \`${changeId}\``,
    "",
    "```",
    `<!-- badge.svg lives at changes/${changeId}/badge.svg -->`,
    "```",
    "",
    `![orion status](changes/${changeId}/badge.svg)`,
    "",
  ].join("\n");
}

export interface BadgeResult {
  change: string;
  status: BadgeStatus;
  svgPath: string;
  svgBytes: number;
  markdown: string;
}

/** Write `changes/<id>/badge.svg` and return the SVG + markdown snippet. */
export function writeBadge(changeId: string): BadgeResult | null {
  const receipt = readReceipt(changeId);
  if (!receipt) {
    // No receipt → grey "not verified" badge is still written (visible truth).
    const svg = renderBadgeSvg(null);
    const path = `changes/${changeId}/badge.svg`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, svg, "utf8");
    return {
      change: changeId,
      status: "not verified",
      svgPath: path,
      svgBytes: Buffer.byteLength(svg),
      markdown: renderBadgeMarkdown(changeId),
    };
  }
  const svg = renderBadgeSvg(receipt);
  const path = `changes/${changeId}/badge.svg`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg, "utf8");
  return {
    change: changeId,
    status: deriveBadgeStatus(receipt),
    svgPath: path,
    svgBytes: Buffer.byteLength(svg),
    markdown: renderBadgeMarkdown(changeId),
  };
}
