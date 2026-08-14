/**
 * GREEN — 4.9/4.10 `orion update`: AI-agent command generators (Claude/Cursor).
 *
 * src/core/updateAgent.ts: updateAgentFiles() детектирует .claude/commands/ и
 * .cursor/rules/ (только реально существующие), пишет .claude/commands/orion.md
 * + .cursor/rules/orion.mdc. Содержимое учит агента: задача выполнена ТОЛЬКО
 * если `orion badge <change>` = verified / receipt.json — честный сертификат,
 * а не своё ощущение («source of truth», «not your feeling»). Поток new →
 * change → badge. Идемпотентно: повторный запуск не дублирует/не меняет
 * существующие файлы; отличающийся — регенерирует (refresh). CLI `orion
 * update` печатает что сгенерировано/обновлено.
 */
