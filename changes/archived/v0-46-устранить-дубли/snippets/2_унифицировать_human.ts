// SNIPPET: унифицировать human/humanBytes
// serve.ts:388 function human(n) — удалить, заменить вызовы на humanBytes из utils/file.ts
// Вызовы: serve.ts:333 human(eco.savedBytes), serve.ts:347 human(b.bytes)
// humanBytes(bytes) возвращает "123 B", "45.6 KB", "1.2 MB" — формат совместим
