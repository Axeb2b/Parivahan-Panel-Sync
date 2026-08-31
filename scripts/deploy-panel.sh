#!/usr/bin/env bash
set -euo pipefail
SRC="/root/Parivahan-Panel-Sync"
OPT_P="/opt/parivahan"
echo "[deploy-panel $(date -Is)] start"
echo "--- git pull ---"
cd "$SRC"
GIT_SSH_COMMAND='ssh -i /root/.ssh/github_deploy_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' git pull --ff-only origin main 2>&1 | head -20
echo "--- pnpm install ---"
pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false --config.strictPeerDependencies=false 2>&1 | tail -20
echo "--- pnpm build ---"
pnpm run build 2>&1 | tail -40
echo "build done, checking dists"
ls -lh "$SRC/artifacts/api-server/dist/" 2>&1 | head -10
ls -lh "$SRC/artifacts/web-panel/dist/" 2>&1 | head -10
echo "--- sync /opt/parivahan (symlink farm) ---"
mkdir -p /opt/parivahan/artifacts/api-server
mkdir -p /opt/parivahan/artifacts/web-panel
# point opt artifacts at source dists (no copy, always fresh)
ln -sfn "$SRC/artifacts/api-server/dist" /opt/parivahan/artifacts/api-server/dist 2>&1 || true
ln -sfn "$SRC/artifacts/web-panel/dist" /opt/parivahan/artifacts/web-panel/dist 2>&1 || true
ln -sfn "$SRC/artifacts/web-panel/dist/public" /opt/parivahan/web-public 2>&1 || true
# also keep nginx expected path
mkdir -p /opt/parivahan/artifacts/web-panel/dist/public 2>&1 || true
# if nginx points to /opt/parivahan/artifacts/web-panel/dist/public, ensure it resolves
ls -la /opt/parivahan/artifacts/web-panel/dist/public 2>&1 | head -5
ls -la /opt/parivahan/web-public 2>&1 | head -5
echo "--- restart api ---"
systemctl restart parivahan-api.service 2>&1
sleep 3
systemctl is-active parivahan-api.service 2>&1
journalctl -u parivahan-api.service --no-pager -n 10 2>&1 | tail -20
echo "--- reload nginx ---"
nginx -t 2>&1
systemctl reload nginx 2>&1 || service nginx reload 2>&1
echo "--- verify ---"
curl -s -o /dev/null -w "panel.kimiaxe.com: %{http_code} time=%{time_total}s\n" https://panel.kimiaxe.com/ 2>&1
curl -s http://127.0.0.1:5001/api/healthz 2>&1 | head -3
echo "[deploy-panel done]"
