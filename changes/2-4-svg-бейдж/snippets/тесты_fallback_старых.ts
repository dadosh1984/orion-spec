/**
 * GREEN — fallback для старых receipt.json без status.
 *
 * fallbackStatus(): coverage "not measured" → partial; явный fail-текст в
 * tests/spec/hazards → failing; ничего не известно → failing. deriveBadgeStatus
 * использует status когда есть, иначе fallbackStatus. Также проверено:
 * coverage НЕ рисуется на бейдже при "not measured", но рисуется когда измерен
 * (напр. "81%"). renderBadgeMarkdown печатает сниппет.
 */
