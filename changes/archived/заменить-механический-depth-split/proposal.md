# Предложение — заменить-механический-depth-split

## Цель
Заменить механический depth-split в renderTasksBody на честное атомарное рекурсивное дробление: дерево спускается по критериям атомарности (одно действие инструмента / проверяемый результат / нет скрытых суждений), упор в потолок глубины 4-5 превращает остаточную неопределённость в уточняющий вопрос пользователю, каждый атомарный лист матчится через существующий findExistingSkill для повторного использования дешёвых детерминированных skills. Deliverable: atomic decomposition generator в draft + integration leaf-to-skill.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | zero-runtime-deps, замена механического depth-split в renderTasksBody, сохранить - [ ] листья read-safe для forge, criteria атомарности + потолок глубины 4-5 + [ask-user] на потолке, leaf→findExistingSkill (уже есть), тесты |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** довести-стратегию-съесть-слона:shield:76ef425afa46, orion-spec:session:1546e29f7205, скилл-onec-converter-migration:forge:684890ea40c4, скилл-onec-converter-migration:forge:9b6fcea6b6bd, скилл-onec-converter-migration:forge:56cc53ac3e99
