/**
 * GREEN (факт) / assumption — D2: создание тега и публикация 0.52.0.
 *
 * Версия пакета 0.52.0 (совпадает с локальным dist). Тег `v0.52.0` +
 * GitHub Release: триггер через .github/workflows/release.yml (строгий
 * version guard). Ручная альтернатива при отсутствии CI-доступа:
 * `npm publish --provenance` с NPM_TOKEN.
 *
 * Если токены недоступны в этой среде — публикация фиксируется как шаг,
 * оставляется точная команда (`npm publish --dry-run` проверяет tarball),
 * вердикт честно помечается NOT-RUN (не "done"). Проверка: `npm view
 * orion-spec version` должен вернуть `0.52.0`.
 */
