#!/bin/zsh
set -euo pipefail
farore_uid="$(id -u)"
farore_label="net.farore.scene-images"
if launchctl print "gui/$farore_uid/$farore_label" >/dev/null 2>&1; then
  launchctl bootout "gui/$farore_uid/$farore_label"
fi
printf 'De lokale beeldservice is gestopt.\n'
