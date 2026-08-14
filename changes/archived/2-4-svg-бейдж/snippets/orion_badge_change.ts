/**
 * GREEN — CLI: `orion badge <change>`.
 *
 * src/cli/commands.ts case "badge": читает receipt.json через writeBadge,
 * печатает цветной статус (done/error/warn по verified/failing/partial),
 * выводит markdown. Нет change-аргумента → fail("badge requires a change id").
 * Не пересчитывает shield — только читает receipt (один источник правды).
 * Badge доступен как скрытая дорожка, как out/verify (не в registry --help).
 */
