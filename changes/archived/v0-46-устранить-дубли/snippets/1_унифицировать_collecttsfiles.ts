// SNIPPET: унифицировать collectTsFiles
// 1. Добавить в src/utils/file.ts:
//    export function collectTsFiles(dir: string, depth: number): string[] { ... }
//    (взять реализацию из scaleStages/reuse.ts:175 — она более полная)
// 2. В scaleStages/reuse.ts: убрать локальную, импортировать из utils/file.ts
// 3. В skills/shield/policy.ts: убрать локальную (barePackage тоже), импортировать из utils/file.ts
