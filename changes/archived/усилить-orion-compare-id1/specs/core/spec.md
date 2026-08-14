# Spec: compareCmd

`orion compare <id1> <id2>` — side-by-side сравнение двух изменений с
Honest Receipt: каждая сторона показывает phase/tasks/guard/result и
receipt (status verified/partial/failing, tests, coverage если измерена —
не рисуется при not measured). compare — самостоятельная legacy команда
(не alias ls).

## Scope
- In scope: parse.ts (убрать alias compare→ls), compareCmd (добавить receipt),
  tests (compare 4, cli-aliases update).
- Out of scope: diff содержимого артефактов построчно, compare >2 изменений,
  глобальные снапшоты rollback.
