#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL if not already running (idempotent).
if ! pg_isready -q 2>/dev/null; then
  sudo pg_ctlcluster 16 main start 2>/dev/null \
    || sudo service postgresql start 2>/dev/null \
    || true
fi

# Wait for PostgreSQL to accept connections.
for _ in $(seq 1 30); do
  if pg_isready -q 2>/dev/null; then
    break
  fi
  sleep 1
done

if ! pg_isready -q 2>/dev/null; then
  echo "PostgreSQL failed to start" >&2
  exit 1
fi

# Ensure the development database exists.
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='parivahan'" | grep -q 1; then
  sudo -u postgres createdb parivahan
fi

# Set local postgres password for dev (safe in isolated agent VMs).
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" >/dev/null 2>&1 || true

echo "PostgreSQL ready on localhost:5432 (database: parivahan)"
