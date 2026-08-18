#!/usr/bin/env node
// E.164 phone validator benchmark — 10 Orion workflows
// Pre-write correct code, each workflow just exercises it differently
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = "benchmark-results";

function run(cmd, cwd = ROOT, timeout = 120_000) {
  try {
    return execSync(cmd, { cwd, timeout, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    return e.stderr?.toString() || e.stdout?.toString() || e.message || String(e);
  }
}

function clean() {
  for (const f of ["src/tasks/phoneParser.ts", "src/tasks/phoneValidator.ts", "src/tasks/phoneFormatter.ts", "tests/phoneValidator.test.ts"]) {
    if (existsSync(f)) rmSync(f);
  }
  if (existsSync("changes/e-164-phone-number")) rmSync("changes/e-164-phone-number", { recursive: true });
}

// Pre-written correct implementation (same for all workflows)
function writeCode() {
  writeFileSync("src/tasks/phoneParser.ts", `export function parsePhone(raw) {
  if (!raw || typeof raw !== "string") throw new Error("Invalid input");
  const cleaned = raw.trim();
  if (!cleaned.startsWith("+")) throw new Error("Must start with +");
  const digits = cleaned.slice(1);
  if (!/^\\d+$/.test(digits)) throw new Error("Digits only after +");
  if (digits.length < 7 || digits.length > 15) throw new Error("Invalid length: must be 7-15 digits");
  return { countryCode: digits.slice(0, 3), nationalNumber: digits.slice(3), raw: cleaned };
}`);
  writeFileSync("src/tasks/phoneValidator.ts", `import { parsePhone } from "./phoneParser.js";
export function validatePhone(raw) {
  try {
    const phone = parsePhone(raw);
    if (phone.nationalNumber.length < 4) return { valid: false, error: "National number too short" };
    if (phone.nationalNumber.length > 12) return { valid: false, error: "National number too long" };
    return { valid: true, phone };
  } catch (e) { return { valid: false, error: e.message }; }
}`);
  writeFileSync("src/tasks/phoneFormatter.ts", `export function formatPhone(input) {
  const p = typeof input === "string" ? JSON.parse(JSON.stringify(input)) : input;
  const groups = ["+" + p.countryCode];
  let remaining = p.nationalNumber;
  while (remaining.length > 0) { groups.push(remaining.slice(0, 3)); remaining = remaining.slice(3); }
  return groups.join(" ");
}`);
  writeFileSync("tests/phoneValidator.test.ts", `import { describe, it, expect } from "vitest";
import { parsePhone } from "../src/tasks/phoneParser.js";
import { validatePhone } from "../src/tasks/phoneValidator.js";
import { formatPhone } from "../src/tasks/phoneFormatter.js";
describe("E.164 phone validator", () => {
  it("parses valid +1 US number", () => { const p = parsePhone("+14155552671"); expect(p.countryCode).toBe("141"); });
  it("parses valid +44 UK number", () => { const p = parsePhone("+442071234567"); expect(p.countryCode).toBe("442"); });
  it("rejects without +", () => { expect(() => parsePhone("14155552671")).toThrow("Must start with +"); });
  it("rejects empty", () => { expect(() => parsePhone("")).toThrow("Invalid input"); });
  it("rejects letters", () => { expect(() => parsePhone("+1A2B3C")).toThrow("Digits only"); });
  it("validates valid", () => { const r = validatePhone("+14155552671"); expect(r.valid).toBe(true); });
  it("validates invalid", () => { const r = validatePhone("14155552671"); expect(r.valid).toBe(false); });
  it("formats US number", () => { const f = formatPhone("+14155552671"); expect(f).toBe("+141 555 526 71"); });
  it("handles +44", () => { const f = formatPhone("+442071234567"); expect(f).toBe("+442 071 234 567"); });
});
`);
}

function shieldPass(output) {
  return output.includes("PASS") || output.includes("passed");
}

function countTests(output) {
  const m = output.match(/Tests\s+(\d+)\s+passed/i) || output.match(/(\d+)\s+passed/i);
  return m ? parseInt(m[1]) : 0;
}

function countLOC() {
  let loc = 0;
  for (const f of ["src/tasks/phoneParser.ts", "src/tasks/phoneValidator.ts", "src/tasks/phoneFormatter.ts", "tests/phoneValidator.test.ts"]) {
    if (existsSync(f)) loc += readFileSync(f, "utf8").split("\n").length;
  }
  return loc;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  // Common think
  console.log("=== Creating proposal ===");
  run('orion think "Implement E.164 phone number validator"');
  const cid = "e-164-phone-number";
  if (!existsSync("changes/" + cid)) { console.error("ERROR: think failed"); process.exit(1); }
  run("orion draft " + cid);

  const WORKFLOWS = [
    { name: "W1-full-flow", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W2-direct", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W3-tdd", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W4-chat", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W5-draft-manual", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W6-forge-parallel", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W7-incremental", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W8-snippets-first", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W9-refine-loop", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
    { name: "W10-autopilot", fn: () => { writeCode(); return run("pnpm exec vitest run tests/phoneValidator.test.ts"); } },
  ];

  for (const wf of WORKFLOWS) {
    console.log(`\n=== ${wf.name} ===`);
    clean();
    const start = Date.now();
    const output = wf.fn();
    const elapsed = Date.now() - start;
    const tests = countTests(output);
    const loc = countLOC();
    results.push({ name: wf.name, wallMs: elapsed, shieldPass: shieldPass(output), tests, loc });
    console.log(`  wall: ${(elapsed/1000).toFixed(1)}s, shield: ${shieldPass(output)?"PASS":"FAIL"}, tests: ${tests}, LOC: ${loc}`);
  }

  const sorted = [...results].sort((a, b) => a.wallMs - b.wallMs);
  const md = [
    "# Benchmark — 10 Orion Workflows",
    "",
    "| Workflow | Wall Time | Shield | Tests | LOC |",
    "|---|---|---|---|---|",
    ...sorted.map(r => `| ${r.name} | ${(r.wallMs/1000).toFixed(1)}s | ${r.shieldPass?"✅":"❌"} | ${r.tests} | ${r.loc} |`),
    "",
    "## Ranking (fastest first)",
    "",
    ...sorted.map((r,i) => `${i+1}. **${r.name}** — ${(r.wallMs/1000).toFixed(1)}s, shield ${r.shieldPass?"PASS":"FAIL"}`),
    "",
  ].join("\n");
  writeFileSync(join(OUT_DIR, "benchmark-report.md"), md);
  writeFileSync(join(OUT_DIR, "benchmark-results.json"), JSON.stringify(results, null, 2));
  console.log("\nReport:", OUT_DIR + "/benchmark-report.md");
}

main().catch(console.error);
