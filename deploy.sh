#!/usr/bin/env bash
set -euo pipefail

echo "=== Parivahan Panel Deploy ==="

# Install CLI tools
if ! command -v pnpm >/dev/null 2>&1; then
  npm i -g pnpm
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "Install gh CLI from https://github.com/cli/cli"
fi

REPO="Axeb2b/Parivahan-Panel-Sync"
cd /tmp/Parivahan-Panel-Sync

git pull origin main
pnpm install --frozen-lockfile

# Build web panel with current VITE_API_URL
VITE_API_URL="${VITE_API_URL:-https://parivahan-api.onrender.com}"
BASE_PATH="${BASE_PATH:-/}"
pnpm --filter @workspace/web-panel run build

echo "Build done. Push changes if any:"
git add -A
git commit -m "deploy: auto build $(date -Iseconds)" || true
git push origin main

echo "Done. Deploy web panel via GitHub Actions."
echo "Set VITE_API_URL to your API host."
