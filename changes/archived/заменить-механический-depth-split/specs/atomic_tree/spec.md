# Spec: atomicTree

## Purpose
Заменить механический depth-split на честное атомарное рекурсивное
дробление: дерево спускается по критериям атомарности (одно действие /
проверяемый результат / нет скрытых суждений), упор в потолок глубины
4-5 превращает остаточную неопределённость в уточняющий `[ask-user]`
вопрос, каждый атомарный лист сохраняет mark (fact/assumption).

## Scope

- In scope: `src/skills/draft/atomic.ts` (`isAtomicStep`, `countActions`,
  `splitStep`, `atomicTree`) + `renderTasksBody` в `src/skills/draft/handler.ts`,
  использующая `atomicTree` вместо механического depth-split; maintenance
  RED→fix→verify планы не дробятся повторно.
- Out of scope: изменение формата tasks.md (checkboxes сохранены; глаголы
  после детерминаторов трактуются как существительные).

## Acceptance criteria
- [x] depth<2 → плоский список (backward-compatible)
- [x] depth>=2 → атомарные листья по критериям, без поломки forge-парсинга
- [x] потолок maxDepth → избыточная неопределённость → `[ask-user]`
- [x] maintenance планы (RED/GREEN markers) не дробятся
- [x] тесты (критерии, split, потолок, render) зелёные
