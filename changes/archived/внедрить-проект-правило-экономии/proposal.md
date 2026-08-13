# Proposal — внедрить-проект-правило-экономии

**Goal:** Внедрить в проект правило экономии токенов: pi-настройки (defaultThinkingLevel low, hideThinkingBlock), глобальный ~/.pi/agent/AGENTS.md и раздел Token economy в AGENTS.md репозитория — короткие рассуждения, краткие ответы и файлы, budget: compact в orion think, сжатие вывода команд. Плюс зафиксировать, что уже сделано, и описать как это проверить. — orion-dev (pi harness + Orion CLI)

- Platform: Изменения вне репозитория (~/.pi/agent/*) уже применены; в репозитории AGENTS.md уже дополнен. Не переделывать код Orion. Сами артефакты изменения делать краткими (budget: compact).
- Constraints: compact
- Budget: compact
- **Lessons applied (v0.12):** фаза-11-новая-порция:forge:ee652ae2c290, orion-spec:session:eb355cdf0851, orion-spec:session:6b4cf54ad029, фаза-6-внедрить-идеи:shield:a4912ba5105d, v0.18-calibration-debt-budget-indicator:out:77d000f38947
