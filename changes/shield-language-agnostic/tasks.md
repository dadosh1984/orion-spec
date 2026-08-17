# Задачи — рефакторинг-shield-language-agnostic

- [ ] **T1: Интерфейс ShieldAdapter + типы** — `src/core/shield/adapter.ts` + типы в `src/type.ts`
- [ ] **T2: TypeScriptAdapter** — перенос существующей логики из handler.ts в `src/core/shield/typescript.ts`
- [ ] **T3: Config loader** — `src/core/shield/config.ts`: orionShield.json → ShieldConfig
- [ ] **T4: AdaptableShield** — рефакторинг `src/skills/shield/handler.ts`: автодетект + делегирование адаптеру
- [ ] **T5: driftCheck() — обобщение** — `src/core/drift.ts`: поддержка Python AST-экстрактора
- [ ] **T6: Python AST-экстрактор** — `scripts/extract_python_api.py`
- [ ] **T7: PythonAdapter** — `src/core/shield/python.ts`
- [ ] **T8: changeShield.ts — адаптация** — hazard/drift для Python-сниппетов
- [ ] **T9: Тесты** — адаптеры, config, интеграция (все существующие тесты проходят)
