import { ORION_COMMANDS, ORION_FLAGS } from "./commands-list.js";

/**
 * `orion completion bash|zsh|powershell` (v0.37) — generate shell
 * autocomplete scripts. Zero-dependency: static command list, no
 * runtime resolution needed.
 */

const COMMANDS = [...ORION_COMMANDS];
const FLAGS = [...ORION_FLAGS];

export function completionScript(shell: string): string {
  switch (shell) {
    case "bash":
      return bashCompletion();
    case "zsh":
      return zshCompletion();
    case "powershell":
      return pwshCompletion();
    default:
      return `# unknown shell: ${shell}\n# usage: orion completion bash|zsh|powershell\n`;
  }
}

function bashCompletion(): string {
  const cmds = COMMANDS.join(" ");
  const flags = FLAGS.join(" ");
  return `# Orion bash completion — source this file:
#   source <(orion completion bash)
_orion_completion() {
  local cur prev words cword
  _init_completion || return
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  case "\${prev}" in
    --port|--host|--session|--parallel|--token|--lang)
      COMPREPLY=()
      return
      ;;
    orion)
      COMPREPLY=( \$(compgen -W "${cmds}" -- "\$cur") )
      return
      ;;
  esac

  if [[ "\$cur" == -* ]]; then
    COMPREPLY=( \$(compgen -W "${flags}" -- "\$cur") )
    return
  fi

  COMPREPLY=( \$(compgen -W "${cmds}" -- "\$cur") )
}
complete -F _orion_completion orion
`;
}

function zshCompletion(): string {
  const cmds = COMMANDS.map((c) => `'${c}'`).join(" ");
  return `# Orion zsh completion — source this file:
#   source <(orion completion zsh)
# Or add to your ~/.zshrc:
#   eval "\$(orion completion zsh)"
#compdef orion

_orion() {
  local -a commands
  commands=(${cmds})

  _arguments -C \\
    '--no-cache[skip cache]' \\
    '--no-color[disable color]' \\
    '--dry[preview only]' \\
    '--watch[watch mode]' \\
    '--json[json output]' \\
    '--port[server port]: :' \\
    '--host[bind host]: :' \\
    '--session[session file]: :' \\
    '--parallel[parallel workers]: :' \\
    '--token[bearer token]: :' \\
    '--ui[serve dashboard]' \\
    '--lang[template language]: :' \\
    '1: :{_describe command commands}' \\
    '*:: :->args'
}

_orion
`;
}

function pwshCompletion(): string {
  const cmds = COMMANDS.map((c) => `'${c}'`).join(", ");
  return `# Orion PowerShell completion
# Add to your $PROFILE:
#   orion completion powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName orion -ScriptBlock {
  param(\$wordToComplete, \$commandAst, \$cursorPosition)
  \$commands = @(${cmds})
  \$flags = @('--no-cache','--no-color','--dry','--watch','--json',
    '--npm','--port','--host','--session','--parallel','--token','--ui','--lang')

  \$prev = \$commandAst.CommandElements[-2].Value
  if (\$prev -eq 'orion') {
    \$commands | Where-Object { \$_ -like "\$wordToComplete*" }
  } elseif (\$wordToComplete -like '-*') {
    \$flags | Where-Object { \$_ -like "\$wordToComplete*" }
  } else {
    \$commands | Where-Object { \$_ -like "\$wordToComplete*" }
  }
}
`;
}
