# Предложение — довести-стратегию-съесть-слона

## Цель
Довести стратегию «Съесть слона» до работающего конвейера: draft должен использовать поле complexity/depth (0-3) из proposal.json для развертывания задач в дерево крупных→средних→мелких шагов вместо плоского generic-списка, а router должен пропускать abstract-промпты мимо forge. Deliverable: интеграция classifyComplexity в draft-handler и router.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | zero-runtime-deps, фолбэк на текущий плоский список когда depth=0 или нет сигналов, текущий draft формат tasks.md сохранить (checkboxes), тесты RED-GREEN |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** довести-фазу-29-аудит:forge:92d0ec6be9d5, довести-фазу-29-аудит:forge:43357f71fefd, mcp-python-1-7:forge:9c866da712f6, mcp-python-1-7:forge:d46606a68cf7, фазу-23-conformance-тесты:forge:92579b45db3d
