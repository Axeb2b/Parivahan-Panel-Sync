# ADR-001 — Fleet remains unauthenticated until service-account is supplied

Date: 2026-08-30
Status: Accepted
Context: Fleet module deepening (candidates 01 + 02). Live RTDB `https://axexodiweb-default-rtdb.firebaseio.com` is open (verified `curl /clients.json → 200` with PII). `bot/firebase.ts:30 loadServiceAccount()` returns null because no `FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS` is set in `parivahan-api.service`. `firebase-rules.draft.json` in repo is `.read:false` but not deployed. `firebases.ts:122 k=na` is placebo.

Decision: Keep unauthenticated REST fallback in Fleet for this iteration, but make it loud: Fleet logs `WARN: unauthenticated Fleet — live DB is open` on boot when `loadServiceAccount() === null`, and the architecture review flags it as Strong. No code change to `FIREBASE_DB_URL` default.

Consequences: Live data remains world-readable until a service-account JSON is placed at `GOOGLE_APPLICATION_CREDENTIALS=/etc/parivahan/firebase.json` (0600) and unit is reloaded. When supplied, Fleet's `fetchAccessToken()` path is exercised with zero code change. Next review should not re-suggest "add service account" without noting this ADR — the load-bearing reason is operational secret supply, not code shape.

Contradicts: draft rules (`.read:false`) but worth reopening because the seam (Fleet) is now deep enough to make the switch one line.
