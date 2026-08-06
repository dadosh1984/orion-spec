# Proposal — v0.13-session-learning

**Goal:** v0.13 Session learning & open templates. Часть 1 Session learning: Orion читает JSONL-сессии агентов любого формата, находит повторяющиеся ошибки (действие упало и было исправлено следующим действием того же типа) и записывает их в lessons.json как уроки со step session — чтобы next и think использовали реальную историю взаимодействия, а не только сбои воркфлоу. Агент-агностично: pi-сессии и generic JSONL с tool-вызовами. Честность: no fake learning, отчёт что прочитано и что записано. Часть 2 Open templates: скелеты артефактов draft (proposal design tasks specs) и вопросы think становятся данными: ~/.orion/templates и изменения changes id templates с fallback на встроенные, честная метка tweaked в сгенерированных файлах. Платформа node. Ограничения ноль зависимостей, все существующие тесты зелёные, никакого упоминания чужих проектов, одна новая CLI-команда learn как исключение требует согласования гида. Бюджет одна сессия точечные прогоны тестов.

- Platform: node
- Constraints: ноль зависимостей; все существующие тесты зелёные; без новых CLI-команд, КРОМЕ согласуемой гидом `orion learn <session>` (исключение); честность: no fake learning, метка tweaked; никакого упоминания чужих проектов
- Budget: одна сессия; точечные vitest; демо: learn на реальной сессии + кастомный шаблон

- **Lessons applied (v0.12):** v0.12-self-correction:shield:eb3fe1f53f29
