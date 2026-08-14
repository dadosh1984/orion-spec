# Spec: replay

Повторный прогон завершённого изменения на новом коде (4.2 Replay,
регресс-проверка). `orion change <id> --replay` детерминированно сравнивает
`computeReproHash` текущих artifacts с `sha256` из `receipt.json`: совпадение
→ reproducible (0 tokens, cached); расхождение → честный spec-drift; нет
receipt → честный drift. Read-only, ничего не перезаписывает.

## Scope
- In scope: `replay(changeId)` (чистая, детерминированная), CLI `change
  --replay`, тесты (no-receipt, unchanged, drifted, determinism).
- Out of scope: полный токен-пересчёт, undo/rollback (4.1), inter-agent replay,
  сравнение двух изменений (compare).
