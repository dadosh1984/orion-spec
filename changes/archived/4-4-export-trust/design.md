# Дизайн — 4.4 export-trust

## Обзор
Hash-based proof для external verification. Кто угодно (коллега, тул, аудитор)
может доказать, что артефакты change (proposal/tasks/spec/tests) + Honest
Receipt не менялись после `export-trust`. Без крипто-подписей — trust.json
плюс записанные hashes позволяют любому пересчитать и сравнить.

## Ключевые решения
- **Диhамезм**: sha256 каждого артефакта (детерминированно по файлу); tests/
  — детерминированный dir-hash (сортировка путей); integrity = sha256 серез
  упорядоченного канонического JSON {artifacts, receipt}.
- **Embedded receipt**: честность переносится — trust содержит полный receipt
  (status/coverage/т.д.), не только hashes.
- **verify** пересчитывает hashes с диска и сверяет с trust.json + integrity —
  tamper (изменение spec/tests) детектируется.
- **No crypto** (v2 если понадобится external signing). Безопасность: read-only
  (verify), export пишет только trust.json.

## Верификация
- tests/trust.test.ts (5): детерминизм, verify pass, tamper spec/tests,
  no-trust честно.
- Гейт build/lint/tsc/vitest; accumulate к 0.55.0.
