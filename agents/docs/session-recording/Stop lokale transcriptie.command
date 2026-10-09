#!/bin/zsh
set -euo pipefail
farore_uid="$(id -u)"
farore_label="net.farore.whisper"
printf 'Stop eerst je opname in Obsidian en wacht tot het verslag klaar is.\n'
if launchctl print "gui/$farore_uid/$farore_label" >/dev/null 2>&1; then
  launchctl bootout "gui/$farore_uid/$farore_label"
fi
printf 'De Whisper-service is gestopt. Ollama blijft beschikbaar.\n'
farore_script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
if [[ -x "$farore_script_dir/Stop lokale afbeeldingen.command" ]]; then
  "$farore_script_dir/Stop lokale afbeeldingen.command"
fi
