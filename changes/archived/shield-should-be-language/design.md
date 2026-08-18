# Design — shield-language-agnostic

## Overview

Shield (`src/skills/shield/handler.ts`) is tightly coupled to TypeScript: 
- `stepCommand()` reads `package.json` scripts
- `driftCheck()` parses TS exports via regex (`export const`, `function`, `class`)
- `securityScan()` looks for TS-specific patterns (`process.env`, `child_process`)
- `yagniCheck()` counts LOC/imports in `.ts` files

Same approach as `forge-language-agnostic`: abstract via `ShieldAdapter` interface, move existing TS logic into `TypeScriptAdapter`, implement `GradleAdapter` for Java/Gradle projects.

## Modules

- `src/core/shield/` — **new directory**: `adapter.ts` (interface + types), `typescript.ts` (existing logic), `gradle.ts` (Gradle/Java), `config.ts` (loader + auto-detect)
- `src/skills/shield/handler.ts` — **refactored**: uses adapters via factory from config
- `src/core/changeShield.ts` — **refactored**: adaptive hazard/drift via adapter
- `src/type.ts` — **extended**: `ShieldAdapter` types, `ShieldConfig`
- `tests/shield-adapter.test.ts` — **new**: unit tests

## Auto-detect markers

| Marker | Language | Adapter | Shield commands |
|--------|----------|---------|-----------------|
| `build.gradle` / `build.gradle.kts` | Java/Gradle | `GradleAdapter` | `./gradlew check`, `./gradlew compileJava`, `./gradlew test` |
| `pom.xml` | Java/Maven | `GradleAdapter` | same |
| `package.json` | TypeScript/Node.js | `TypeScriptAdapter` | eslint, tsc, vitest (existing) |
| none | fallback | `TypeScriptAdapter` | existing defaults |

## GradleAdapter specification

| Shield check | Command | Success signal |
|--------------|---------|----------------|
| lint | `./gradlew checkstyleMain 2>&1` | exit code 0 |
| type-check | `./gradlew compileJava 2>&1` | `BUILD SUCCESSFUL` |
| test | `./gradlew test --tests "*{task}*" 2>&1` | `BUILD SUCCESSFUL` + no test failures |
| drift | Java AST regex (class/interface/enum + method signatures) | exports match spec |
| security | Java patterns: `Runtime.exec`, `ProcessBuilder`, file I/O, reflection, `@SuppressWarnings` | no matches |
| yagni | LOC + import count in `.java` files | within norms |

## Verification

- [ ] all 916 existing tests pass unchanged
- [ ] `tsc --noEmit` clean
- [ ] TypeScriptAdapter produces identical results to current handler.ts
- [ ] GradleAdapter produces correct commands for Java project
- [ ] auto-detect: `build.gradle` → Gradle, `package.json` → TS, no markers → TS
