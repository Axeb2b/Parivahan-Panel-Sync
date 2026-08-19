#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export CI=true
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm approve-builds --all

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/parivahan}"
corepack pnpm --filter @workspace/db run push
