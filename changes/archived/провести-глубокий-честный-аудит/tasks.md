# Задачи — провести-глубокий-честный-аудит (v0.47)

Легенда: forge переключает квадрат по мере выполнения.

## Фаза A — Windows-совместимость (самое больное)
- [x] [fact] `orion run new`: автоопределение интерпретатора на Windows — node по умолчанию, когда bash недоступен в контексте запуска
- [x] [fact] Интерактивный выбор рантайма (`node|python|bash`) при TTY в `run new`
- [x] [fact] `schedule`/`unschedule`: честный платформ-детект — сообщать «cron только на Linux/macOS» вместо молчаливой сбоя на Windows
- [x] [fact] Кросс-платформенный запуск: `python3` → `python` fallback на Windows

## Фаза B — Дубли и мёртвый код
- [x] [fact] Слить `humanBytes` (file.ts) и `formatBytes` (format.ts) в единый `humanBytes`, убрать дубль
- [x] [fact] Вычистить накопленные регрессионные артефакты в `src/tasks/*` (e2e-мусор прошлых форджей)
- [x] [fact] Удалить неиспользуемые экспорты в `src/utils/*` (прогон по дереву использования)

## Фаза C — User-friendly терминал
- [x] [fact] Проверено: raw `JSON.stringify` уже гейтед флагом `--json` в shield/verify; `profile export` и `mcp --list` намеренно машинные (агентный/порт интерфейс)
- [ ] [fact] Единый модуль форматирования таблиц/деревьев между list/stats/compare (убрать дубли) — отложено: массовый рефакторинг рискован, таблицы уже работают
- [x] [fact] Подтверждение (`[y/N]`) для опасных команд delete/clean/archive при TTY (confirmAction в helpers.ts)

## Фаза D — Производительность
- [ ] [fact] Асинхронный `spawn` вместо блокирующего `execSync` в runtime/runCmd — отложено: меняет сигнатуру runScript, риск регрессий выше пользы на данном этапе
- [x] [fact] Авто-ротация кэша — рассмотрено и отклонено: периодический prune в store ломает детерминизм robustness-теста «10k entries»; кэш уже имеет явный `track prune` (TTL 30d / 100MB) — отложено как преждевременное
- [ ] [fact] Визуальный прогресс-бар для многошагового `forge` — отложено: progressBar удалён в Фазе B как мёртвый

## Фаза E — Функциональность и уникальность
- [ ] [fact] Единый `~/.orion/config.json` runtime-конфиг — отклонено как преждевременное: project-локальные orionTdd/orionTrack версионируются и нужны per-project, глобальный config.json смешал бы понятия
- [x] [fact] Маркdown-сводка — уже есть: `out` пишет result.md, `shield` пишет reports/<id>/guard-report.md
- [x] [fact] Авто-применение уроков — уже есть: `think` заполняет appliesLessons, `draft` вставляет в proposal (+ lessons export/import)
- [x] [fact] Хэш-проверка входных аргументов `run`: runScript кэширует по SHA-256(args+скрипт), idempotent перезапуск; живой тест + unit-тест

## Финал
- [x] [fact] Линт + tsc + 670 тестов — все гейты зелёные (были 663, добавлены тесты A/E)
- [x] [fact] Обновить `README` — добавлен раздел про `orion run` (автономные скрипты, детерминизм); `CHANGELOG` — запись v0.47
