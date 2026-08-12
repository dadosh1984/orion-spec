// SNIPPET: унифицировать bar
// serve.ts:393 function bar(v,m) — удалить, заменить вызовы на bar из utils/term.ts
// utils/term.ts: bar(ratio, width=14) — уже есть
// Нужно адаптировать вызовы: serve.ts использует bar(value, max) → bar(value/max, width)
