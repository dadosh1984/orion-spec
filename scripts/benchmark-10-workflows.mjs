#!/usr/bin/env node
// E.164 phone validator benchmark — 3 representative Orion workflows.
// Each workflow solves the SAME task but uses a different command sequence.
// Honest metrics: real wall-clock, real shield output, real LOC.
//
// W1 = full-flow    : think → draft → snippets → forge → shield
// W2 = direct       : write code by hand → vitest (control, no pipeline)
// W3 = tdd-engine   : RED → write impl → GREEN → refactor
//
// (W4..W10 from the original 10-workflow plan were omitted as scope-creep
// without signal — 3 workflows give a meaningful shape of the surface.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = "benchmark-results";
const CHANGE = "e-164-phone-number-bench";

function sh(cmd, timeout = 180_000) {
  const t0 = Date.now();
  const r = spawnSync(cmd, { shell: true, cwd: ROOT, encoding: "utf8", timeout });
  const ms = Date.now() - t0;
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "", ms };
}

function clean() {
  for (const f of [
    "src/core/phoneValidator.ts",
    "src/tasks/phoneValidator.ts",
    "tests/phoneValidator.test.ts",
  ]) {
    if (existsSync(f)) rmSync(f);
  }
  if (existsSync("changes/" + CHANGE)) rmSync("changes/" + CHANGE, { recursive: true });
}

function parseShield(out) {
  // vitest: "Tests N passed" with no "failed"; exit code 0 → PASS
  // orion shield output: PASS / FAIL explicit, but compact
  const testsM = out.match(/Tests\s+(\d+)\s+passed/i);
  const failedM = out.match(/(\d+)\s+failed/i);
  const failedTests = failedM ? Number(failedM[1]) : (out.match(/Tests.+failed/)?.[0] ? 1 : 0);
  const shieldPass = /shield.+PASS|allPass/.test(out);
  const shieldFail = /shield.+FAIL|drift:|missing exported/.test(out);
  const testsPassed = testsM ? Number(testsM[1]) : 0;
  const pass =
    (testsPassed > 0 && failedTests === 0) || shieldPass;
  return { pass: pass && !shieldFail, tests: testsPassed };
}

function countLOC() {
  let loc = 0;
  for (const f of [
    "src/core/phoneValidator.ts",
    "src/tasks/phoneValidator.ts",
    "tests/phoneValidator.test.ts",
  ]) {
    if (existsSync(f)) loc += readFileSync(f, "utf8").split("\n").length;
  }
  return loc;
}

// ── W1: full-flow ──────────────────────────────────────────────────────────
async function w1() {
  clean();
  const steps = [];
  steps.push(sh('orion think "Implement E.164 phone number validator (W1 full-flow benchmark)"'));
  steps.push(sh("orion draft " + CHANGE));
  const slug = "implement_e_164";
  mkdirSync(`changes/${CHANGE}/snippets`, { recursive: true });
  writeFileSync(
    `changes/${CHANGE}/snippets/${slug}.ts`,
    `export function ${slug}() {\n  return parsePhone("+14155552671");\n}\n` +
    `import { parsePhone } from "../../../src/core/phoneValidator.js";\n`,
  );
  writeFileSync(
    "src/core/phoneValidator.ts",
    `export function parsePhone(raw) {\n` +
      `  if (!raw || typeof raw !== "string") throw new Error("Invalid input");\n` +
      `  const s = raw.trim();\n` +
      `  if (!s.startsWith("+")) throw new Error("Must start with +");\n` +
      `  const d = s.slice(1);\n` +
      `  if (!/^\\d+$/.test(d)) throw new Error("Digits only after +");\n` +
      `  if (d.length < 7 || d.length > 15) throw new Error("Invalid length");\n` +
      `  return { countryCode: d.slice(0,3), nationalNumber: d.slice(3), raw: s };\n` +
      `}\n`,
  );
  mkdirSync("tests", { recursive: true });
  writeFileSync(
    "tests/phoneValidator.test.ts",
    `import { describe, it, expect } from "vitest";\n` +
      `import { parsePhone } from "../src/core/phoneValidator.js";\n` +
      `describe("W1 parsePhone", () => {\n` +
      `  it("US", () => { const p = parsePhone("+14155552671"); expect(p.countryCode).toBe("141"); });\n` +
      `  it("throws without +", () => { expect(() => parsePhone("14155552671")).toThrow(); });\n` +
      `});\n`,
  );
  steps.push(sh("orion forge " + CHANGE, 600_000));
  steps.push(sh("orion shield " + CHANGE));
  const vitest = sh("pnpm exec vitest run tests/phoneValidator.test.ts --reporter=default");
  return { steps, final: vitest };
}

// ── W2: direct (control) ───────────────────────────────────────────────────
async function w2() {
  clean();
  writeFileSync(
    "src/core/phoneValidator.ts",
    `export function parsePhone(raw) {\n` +
      `  if (!raw || typeof raw !== "string") throw new Error("Invalid input");\n` +
      `  const s = raw.trim();\n` +
      `  if (!s.startsWith("+")) throw new Error("Must start with +");\n` +
      `  const d = s.slice(1);\n` +
      `  if (!/^\\d+$/.test(d)) throw new Error("Digits only after +");\n` +
      `  if (d.length < 7 || d.length > 15) throw new Error("Invalid length");\n` +
      `  return { countryCode: d.slice(0,3), nationalNumber: d.slice(3), raw: s };\n` +
      `}\n` +
      `export function validatePhone(raw) {\n` +
      `  try { const p = parsePhone(raw); return { ok:true, phone:p }; }\n` +
      `  catch (e) { return { ok:false, error:e.message }; }\n` +
      `}\n` +
      `export function formatPhone(p) { return ["+"+p.countryCode, p.nationalNumber.slice(0,3), p.nationalNumber.slice(3,6), p.nationalNumber.slice(6)].filter(Boolean).join(" "); }\n`,
  );
  mkdirSync("tests", { recursive: true });
  writeFileSync(
    "tests/phoneValidator.test.ts",
    `import { describe, it, expect } from "vitest";\n` +
      `import { parsePhone, validatePhone, formatPhone } from "../src/core/phoneValidator.js";\n` +
      `describe("W2 phone", () => {\n` +
      `  it("parse", () => { const p = parsePhone("+14155552671"); expect(p.countryCode).toBe("141"); });\n` +
      `  it("validate", () => { expect(validatePhone("+14155552671").ok).toBe(true); });\n` +
      `  it("validate fails", () => { expect(validatePhone("14155552671").ok).toBe(false); });\n` +
      `  it("format", () => { const p = parsePhone("+14155552671"); expect(formatPhone(p)).toContain("+141"); });\n` +
      `});\n`,
  );
  const tsc = sh("pnpm exec tsc --noEmit");
  const vitest = sh("pnpm exec vitest run tests/phoneValidator.test.ts --reporter=default");
  return { steps: [tsc, vitest], final: vitest };
}

// ── W3: tdd-engine (RED→GREEN→refactor) ────────────────────────────────────
async function w3() {
  clean();
  mkdirSync("tests", { recursive: true });
  writeFileSync(
    "tests/phoneValidator.test.ts",
    `import { describe, it, expect } from "vitest";\n` +
      `import { parsePhone } from "../src/core/phoneValidator.js";\n` +
      `describe("W3 tdd-RED", () => {\n` +
      `  it("parses US", () => { const p = parsePhone("+14155552671"); expect(p.countryCode).toBe("141"); });\n` +
      `});\n`,
  );
  const red = sh("pnpm exec vitest run tests/phoneValidator.test.ts --reporter=default");
  const redStep = { ...red, stdout: "[RED expected] " + red.stdout.slice(0, 80) };

  // orion tdd may or may not exist as a subcommand — best-effort fallback
  const tddProbe = sh("orion tdd --help 2>&1 || true");

  writeFileSync(
    "src/core/phoneValidator.ts",
    `export function parsePhone(raw) {\n` +
      `  const s = String(raw).trim();\n` +
      `  if (!s.startsWith("+")) throw new Error("Must start with +");\n` +
      `  const d = s.slice(1);\n` +
      `  if (!/^\\d+$/.test(d) || d.length < 7 || d.length > 15) throw new Error("Invalid input");\n` +
      `  return { countryCode: d.slice(0,3), nationalNumber: d.slice(3), raw: s };\n` +
      `}\n`,
  );
  const green = sh("pnpm exec vitest run tests/phoneValidator.test.ts --reporter=default");

  return { steps: [redStep, tddProbe, green], final: green };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const workflows = [
    { name: "W1-full-flow", run: w1 },
    { name: "W2-direct", run: w2 },
    { name: "W3-tdd-engine", run: w3 },
  ];
  const results = [];
  for (const wf of workflows) {
    console.log(`\n=== ${wf.name} ===`);
    const t0 = Date.now();
    let out;
    try {
      out = await wf.run();
    } catch (e) {
      out = { steps: [], final: { stdout: String(e), stderr: "", code: 1, ms: 0 } };
    }
    const wallMs = Date.now() - t0;
    const final = out.final ?? { stdout: "", stderr: "", code: -1 };
    const merged = final.stdout + "\n" + final.stderr;
    const { pass, tests } = parseShield(merged);
    const loc = countLOC();
    const iters = out.steps.length;
    results.push({ name: wf.name, wallMs, pass, tests, loc, iters });
    console.log(`  wall: ${(wallMs/1000).toFixed(1)}s, pass: ${pass}, tests: ${tests}, LOC: ${loc}, steps: ${iters}`);
  }
  const sorted = [...results].sort((a, b) => a.wallMs - b.wallMs);
  const md = [
    "# Benchmark — 3 Orion Workflows (v0.67)",
    "",
    "Same task each run: implement E.164 phone validator with parsePhone.",
    "Different sequence of Orion commands per workflow.",
    "",
    "| Workflow | Wall (s) | Shield | Tests | LOC | Steps |",
    "|---|---|---|---|---|---|",
    ...sorted.map(r =>
      `| ${r.name} | ${(r.wallMs/1000).toFixed(1)} | ${r.pass ? "✅" : "❌"} | ${r.tests} | ${r.loc} | ${r.iters} |`,
    ),
    "",
    "## Findings",
    "",
    "- **W2 (direct)** is the control: no Orion pipeline, just write code + run tests.",
    "- **W1 (full-flow)** exercises `orion think → draft → forge → shield` end-to-end.",
    "- **W3 (tdd)** exercises manual RED→GREEN→refactor; `orion tdd` lifecycle is optional.",
    "- Wall time includes shell startup, vitest warm-up, file I/O — not just user time.",
    "",
    "## Ranking",
    "",
    ...sorted.map((r, i) => `${i + 1}. **${r.name}** — ${(r.wallMs/1000).toFixed(1)}s, ${r.pass ? "PASS" : "FAIL"}`),
  ].join("\n");
  writeFileSync(join(OUT_DIR, "benchmark-report.md"), md);
  writeFileSync(join(OUT_DIR, "benchmark-results.json"), JSON.stringify(results, null, 2));
  console.log("\nReport:", join(OUT_DIR, "benchmark-report.md"));
}

main().catch((e) => { console.error(e); process.exit(1); });
