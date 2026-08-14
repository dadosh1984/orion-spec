/**
 * GREEN — orion compare <id1> <id2>: side-by-side + Honest Receipt.
 *
 * parse.ts: убран deprecated-alias `compare: "ls"` (v0.52 консолидировал
 * compare→ls, но терял side-by-side). Вернули самостоятельный legacy case:
 * `orion compare a b` зовёт compareCmd (v0.33), а не ls.
 *
 * compareCmd.ts: добавлена строка Honest Receipt на каждую сторону —
 * status (verified/partial/failing), tests, coverage ТОЛЬКО если измерена
 * (не рисуется при "not measured" — паттерн честности). corrupt/absent →
 * "receipt: not run". Сравнение двух подходов по их честным рецептам
 * («какой подход честнее»), не только по task-count. Read-only.
 *
 * Тесты tests/compare.test.ts (4) + tests/cli-aliases.test.ts (compare
 * больше не alias ls). Live: verified+coverage vs partial без coverage.
 * Accumulate к 0.55.0, не в текущий релиз.
 */
