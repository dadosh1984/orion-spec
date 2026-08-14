/**
 * GREEN — renderBadgeMarkdown/ writeBadge: markdown-сниппет для README.
 *
 * renderBadgeMarkdown(changeId) → markdown-блок (заголовок + ссылка на
 * badge.svg). writeBadge(changeId): пишет changes/<id>/badge.svg (mkdir как
 * надо) и возвращает { status, svgPath, svgBytes, markdown }. Отсутствующий
 * или битый receipt.json → серый "not verified", а не зеленый по умолчанию.
 */
