#!/bin/zsh
set -euo pipefail
farore_uid="$(id -u)"
farore_label="net.farore.scene-images"
farore_plist="$HOME/Library/LaunchAgents/$farore_label.plist"
if ! launchctl print "gui/$farore_uid/$farore_label" >/dev/null 2>&1; then
  launchctl bootstrap "gui/$farore_uid" "$farore_plist"
fi
if ! curl -fsS --max-time 2 http://127.0.0.1:11435/api/version >/dev/null 2>&1; then
  launchctl kickstart "gui/$farore_uid/$farore_label"
fi
for farore_attempt in {1..45}; do
  if curl -fsS --max-time 2 http://127.0.0.1:11435/api/version >/dev/null 2>&1; then
    printf 'Lokale scène-afbeeldingen zijn klaar voor Obsidian.\n'
    exit 0
  fi
  sleep 1
done
printf 'Beeldservice startte niet. Zie ~/Library/Application Support/Farore Scene Illustrator/service.log\n'
exit 1
