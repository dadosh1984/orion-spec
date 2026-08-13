# Spec: renderTasksBody

## Purpose
Развернуть задачи в дерево «крупные→средние→мелкие» по стратегии «Съесть
слона» на основе `proposal.depth`, и гейтить abstract-промпты мимо forge.

## Scope

- In scope: `renderTasksBody()` в `src/skills/draft/handler.ts` (depth 0-3 →
  `## big step` / `### medium` группы с `- [ ]` листьями, без отступов,
  чтобы forge-readTasks их читал); abstract-гейт в `src/core/router.ts`.
- Out of scope: изменение формата задач (checkboxes сохранены), новая модель.

## Acceptance criteria
- [ ] depth<2 → плоский список (backward-compatible)
- [ ] depth 2 → 2 `## big step` группы
- [ ] depth 3 → 2 `## big step`, по 2 `### medium` в каждой
- [ ] каждый лист `- [ ]` на строке без отступа → forge readTasks парсит
- [ ] abstract-промпты → router DIRECT_AI
