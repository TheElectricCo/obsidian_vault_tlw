#!/bin/zsh
set -euo pipefail
farore_uid="$(id -u)"
farore_label="net.farore.whisper"
printf 'Stop eerst je opname in Obsidian en wacht tot het verslag klaar is.\n'
if launchctl print "gui/$farore_uid/$farore_label" >/dev/null 2>&1; then
  launchctl bootout "gui/$farore_uid/$farore_label"
fi
printf 'De Whisper-service is gestopt. Ollama blijft beschikbaar.\n'
