#!/bin/zsh
set -euo pipefail
farore_uid="$(id -u)"
farore_label="net.farore.whisper"
farore_plist="$HOME/Library/LaunchAgents/$farore_label.plist"
if ! launchctl print "gui/$farore_uid/$farore_label" >/dev/null 2>&1; then
  launchctl bootstrap "gui/$farore_uid" "$farore_plist"
fi
if ! curl -fsS --max-time 2 http://127.0.0.1:8178/health >/dev/null 2>&1; then
  launchctl kickstart "gui/$farore_uid/$farore_label"
fi
printf 'Whisper wordt gestart. Eerste start kan iets langer duren.\n'
for farore_attempt in {1..45}; do
  if curl -fsS --max-time 2 http://127.0.0.1:8178/health >/dev/null 2>&1; then
    if curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
      printf 'Klaar: lokale transcriptie en Ollama zijn bereikbaar. Open LexVoice in Obsidian.\n'
      exit 0
    fi
    printf 'Whisper is klaar. Start ook de Ollama-app voor sessienotities.\n'
    exit 1
  fi
  sleep 1
done
printf 'Whisper startte niet op tijd. Zie ~/Library/Application Support/Farore Session Recorder/whisper.log\n'
exit 1
