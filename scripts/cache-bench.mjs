#!/usr/bin/env node
/* Cache benchmark (v0.29, T5.1): many small files vs one file per namespace.
 * Prints honest timings so a storage-format change is driven by numbers,
 * not vibes. Run: node scripts/cache-bench.mjs
 */
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const round = (n) => Math.round(n * 1000) / 1000;

function bench(label, n, fn) {
  fn(0); // warm
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn(i);
  const el = (performance.now() - t0) / n;
  console.log(`${label.padEnd(52)} ${round(el).toFixed(4)} ms/op`);
  return el;
}

const payload = "x".repeat(2048);
let DIR = mkdtempSync(join(tmpdir(), "orion-cache-bench-"));

bench("many small files: write 2048B x 2000", 2000, (i) => {
  writeFileSync(join(DIR, `k${i}.json`), payload);
});
bench("many small files: read 2048B x 2000", 2000, (i) => {
  void readFileSync(join(DIR, `k${i}.json`), "utf8");
});

rmSync(DIR, { recursive: true, force: true });
DIR = mkdtempSync(join(tmpdir(), "orion-cache-blob-"));
const blob = join(DIR, "one.json");
const entries = new Array(2000).fill(null).map((_, i) => [`k${i}`, payload]);
writeFileSync(blob, JSON.stringify(entries));

bench("single-file blob: write 2000 entries", 40, (i) => {
  writeFileSync(blob, JSON.stringify(entries.map((e) => [i, e[1]])));
});
bench("single-file blob: parse 2000 entries", 500, () => {
  void JSON.parse(readFileSync(blob, "utf8"));
});

console.log("\nInterpretation: orion-track uses many-small files (per-entry TTL,");
console.log("fine-grained eviction, no read-amplification on a single hit). The");
console.log("single-blob parse time is the cost only when the whole namespace is");
console.log("read at once — which orion does rarely, so the current format is fine.");
rmSync(DIR, { recursive: true, force: true });
