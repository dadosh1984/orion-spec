// === T4: AdaptableShield — рефакторинг handler.ts ===
// Изменения в shield() и runStep() для использования адаптеров
// ponytail: rung-2 — refactoring; existing logic preserved in TypeScriptAdapter

/**
 * === ИЗМЕНЕНИЯ В src/skills/shield/handler.ts ===
 *
 * 1. В начале shield(): resolveAdapter() вместо хардкода stepCommand
 * 2. runStep("lint"/"type"/"test"): делегирует adapter.get*Command()
 * 3. runStep("drift"): использует adapter.extractApi() + collectExports
 * 4. runStep("security"): использует adapter.getSecurityPatterns()
 * 5. yagniCheck: использует adapter.fileMetrics()
 * 6. collectExports() удалён из handler.ts (живёт в TypeScriptAdapter)
 */

// --- Ключевые изменения в shield() ---

// В начале shield() добавляем:
//   initAdapters();
//   const adapter = resolveAdapter();

// --- runStep после рефакторинга ---

// async function runStep(step: StepName, changeId: string, adapter: ShieldAdapter): Promise<GuardCheckResult> {
//   switch (step) {
//     case "lint": {
//       const cmd = adapter.getLintCommand();
//       if (!cmd) return { step, status: "SKIP", detail: `no lint configured for ${adapter.id}` };
//       return shellCheck(step, `${cmd.cmd} ${cmd.args.join(" ")}`, cmd.parser);
//     }
//     case "type": { ... adapter.getTypeCheckCommand() ... }
//     case "test": { ... adapter.getTestCommand() ... }
//     case "drift": return driftCheck(changeId, adapter);
//     case "security": return securityScan(changeId, adapter);
//     // остальные шаги без изменений
//   }
// }

// --- driftCheck переписан ---

// async function driftCheck(changeId: string, adapter: ShieldAdapter): Promise<GuardCheckResult> {
//   const specsDir = `changes/${changeId}/specs`;
//   if (!existsSync(specsDir)) {
//     return { step: "drift", status: "PASS", detail: "no specs to compare" };
//   }
//   const expected: string[] = [];
//   for (const dir of readdirSync(specsDir)) {
//     const specFile = join(specsDir, dir, "spec.md");
//     if (!existsSync(specFile)) continue;
//     const spec = readFileSync(specFile, "utf8");
//     for (const m of spec.matchAll(/^# Spec: (.+)$/gm))
//       expected.push(m[1].trim());
//   }
//   if (expected.length === 0) {
//     return { step: "drift", status: "PASS", detail: "no capabilities in specs" };
//   }
//
//   // Извлекаем API через адаптер
//   const srcFiles: string[] = [];
//   if (existsSync("src")) {
//     const walkDir = (dir: string): void => {
//       for (const ent of readdirSync(dir, { withFileTypes: true })) {
//         const p = join(dir, ent.name);
//         if (ent.isDirectory()) walkDir(p);
//         else if (adapter.id === "python" ? ent.name.endsWith(".py") : ent.name.endsWith(".ts"))
//           srcFiles.push(p);
//       }
//     };
//     walkDir("src");
//   }
//   const exports = new Set(adapter.extractApi(srcFiles));
//   const missing = expected.filter((cap) => !exports.has(cap));
//   return missing.length === 0
//     ? { step: "drift", status: "PASS", detail: `matched ${expected.length} capabilities` }
//     : { step: "drift", status: "FAIL", detail: `missing exported: ${missing.join(", ")}` };
// }

// --- securityScan переписан ---

// async function securityScan(changeId: string, adapter: ShieldAdapter): Promise<GuardCheckResult> {
//   const roots = ["src", `changes/${changeId}/snippets`].filter((p) => existsSync(p));
//   if (roots.length === 0)
//     return { step: "security", status: "PASS", detail: "no source to scan" };
//   const findings: string[] = [];
//   const patterns = adapter.getSecurityPatterns();
//   const ext = adapter.id === "python" ? ".py" : ".ts";
//   for (const root of roots) {
//     for (const file of walk(root)) {
//       if (!file.endsWith(ext)) continue;
//       const code = readFileSync(file, "utf8");
//       const literals = literalRanges(code);
//       for (const { re, label } of patterns) {
//         const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
//         let m: RegExpExecArray | null;
//         while ((m = rx.exec(code)) !== null) {
//           if (startsInLiteral(literals, m.index, ["comment", "string"])) continue;
//           findings.push(`${file}: ${label}`);
//           break;
//         }
//       }
//     }
//   }
//   ...остальное без изменений...
// }

// --- collectExports и stepCommand удалены из handler.ts ---
// (перенесены в TypeScriptAdapter)
