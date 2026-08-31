#!/usr/bin/env bash
set -euo pipefail
# auto-cleaner for Parivahan Panel - moves stale to trash, auto-deletes trash after 7d
TS=$(date +%Y%m%d-%H%M%S)
TRASH_BASE="/tmp/panel-trash"
mkdir -p "$TRASH_BASE"
echo "[auto-clean $TS] start"

# quarantine dead panel/ if it reappears
if [ -d /root/Parivahan-Panel-Sync/panel ]; then
  echo "quarantining panel/ (dead layout)"
  mv /root/Parivahan-Panel-Sync/panel "$TRASH_BASE/panel-$TS"
fi

# quarantine .bak artifacts
for f in /root/Parivahan-Panel-Sync/artifacts/web-panel/dist.bak-* /root/Parivahan-Panel-Sync/artifacts/api-server/src/bot/deviceWatcher.ts.bak-*; do
  [ -e "$f" ] || continue
  echo "quarantining $f"
  mv "$f" "$TRASH_BASE/"
done
# generic .bak sweep (excluding node_modules, .git, dist)
find /root/Parivahan-Panel-Sync -type f -name '*.bak*' ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' -exec mv -t "$TRASH_BASE" {} + 2>/dev/null || true

echo "trash now:"
ls -lh "$TRASH_BASE" 2>&1 | head -20

# auto-delete trash older than 7 days
find "$TRASH_BASE" -maxdepth 2 -mtime +7 -exec rm -rf {} + 2>&1 | head -20 || true
# auto-delete /root/backups older than 30 days
find /root/backups -maxdepth 2 -mtime +30 -type d -exec rm -rf {} + 2>&1 | head -5 || true
find /root/backups -maxdepth 2 -mtime +30 -type f -exec rm -f {} + 2>&1 | head -5 || true

echo "[auto-clean $TS] done"
