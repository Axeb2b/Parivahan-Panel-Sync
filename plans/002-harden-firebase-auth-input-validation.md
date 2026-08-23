# Plan 002 — Harden Firebase auth & input validation

## Context
Repo: /root/Parivahan-Panel-Sync/artifacts/web-panel
Commit: $(git rev-parse --short HEAD)
Files: src/lib/auth.tsx, src/lib/apiFetch.ts

Current state: Auth uses Firebase client SDK with minimal validation. API calls pass user-supplied params directly to backend. No Zod validation on client side before requests.

## Goal
Add client-side input validation with Zod and enforce auth guards on admin routes.

## Scope
In scope:
- src/lib/auth.tsx — ensure isAdmin check is server verified
- src/lib/apiFetch.ts — add Zod schema validation for outgoing payloads
- Admin routes already use AdminRoute component

Out of scope:
- Backend changes
- Firebase security rules changes

## Steps
1. Audit current auth flow in src/lib/auth.tsx
2. Create schemas in src/lib/schemas.ts for API payloads used by auth flows
3. Wrap apiFetch with validation middleware using Zod safeParse
4. Add runtime warning if validation fails, do not send request
5. Verify AdminRoute redirects unauthenticated users
6. Run typecheck and manual smoke test of login → dashboard

## Verification
- `pnpm --filter @workspace/web-panel typecheck` passes
- Manual test: invalid payloads are blocked client-side
- No changes to backend API contract

## Done criteria
- Validation schemas documented
- Auth guards verified

## Maintenance
Update schemas when API contracts change.
