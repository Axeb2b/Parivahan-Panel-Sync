# Plan 001 — Add unit tests for device normalization

## Context
Repo: /root/Parivahan-Panel-Sync/artifacts/web-panel
Commit: $(git rev-parse --short HEAD)
File under test: src/lib/normalizeDevice.ts

Current state: normalizeDevice is used in Dashboard to transform raw Firebase device objects into NormalizedDevice. No tests exist. Changes risk silent data breakage.

## Goal
Add unit tests with >90% coverage for normalizeDevice, including edge cases for missing fields.

## Scope
In scope:
- src/lib/normalizeDevice.ts
- New test file src/lib/normalizeDevice.test.ts

Out of scope:
- No changes to Dashboard component
- No Firebase mocking beyond static fixtures

## Steps
1. Create src/lib/normalizeDevice.test.ts using Vitest (already in devDependencies via package.json).
2. Export normalizeDevice for testing if not already exported.
3. Add fixtures for:
   a) Full device payload
   b) Missing optional fields: upi, battery, ip_address
   c) Malformed raw values
4. Assert expected NormalizedDevice shape for each fixture.
5. Run `pnpm --filter @workspace/web-panel test` and verify all pass.
6. Run `pnpm --filter @workspace/web-panel typecheck` to ensure no TS errors.

## Verification
- `pnpm --filter @workspace/web-panel test` exits 0
- Coverage report shows normalizeDevice.ts >=90%
- `git diff` shows only test file added, no source changes

## Done criteria
- Tests pass locally
- Plan file lists exact commands used

## Maintenance
Future changes to normalizeDevice must update tests first.

