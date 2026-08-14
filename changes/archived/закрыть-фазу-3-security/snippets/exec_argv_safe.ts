/**
 * GREEN — 3.8 shell-injection закрыт (argv-безопасное выполнение).
 *
 * runtime.ts run-скрипт: execSync(cmd)-строка → execFileSync(bin,
 * [scriptFile], {env: denyEnv(process.env)}) — node/python/bash через argv,
 * без shell. runCmd.ts watcher → spawnSync(execPath,[cli,"run",wName]);
 * repair-fix → spawnSync(execPath,[cli,"forge",sourceChange,"--save-as",
 * name]); edit → spawnSync(bin,[...flags,scriptPath(name)],{shell:false})
 * (editor сплит на argv). Имя скрипта/промпт агента не может стать
 * shell-инъекцией. Важно: log/console-бэктики `${...}` не в exec-binding.
 */
