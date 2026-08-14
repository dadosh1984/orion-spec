/**
 * GREEN — src/skills/out/badge.ts: рендерер самодостаточного SVG-бейджа.
 *
 * readReceipt(changeId): читает changes/<id>/receipt.json; null если файла
 * нет/битый. deriveBadgeStatus: `status` из receipt, иначе fallbackStatus из
 * строк (для pre-2.4 receipt без status). renderBadgeSvg(null) → серый
 * "not verified"; иначе статус-цвет: verified #4c1, partial #dfb317, failing
 * #e05d44, not verified #9f9f9f. Ширина адаптивна (вычислена из текста,
 * детерминированно). Нет внешних шрифтов/сети; моноширинные системные.
 */
