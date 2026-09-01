## Feature Goal

- Port legacy obfuscated panel (REST + secret + setInterval) parity to Vite React https://panel.kimiaxe.com — fix refresh persistence + load speed, implement Nuke mass-OTP loop + Auto-ping + bulk Send + Device CRUD/notes/CSV, redesign dashboard fresh (indigo/teal industrial) — live deploy.

## Confirmed Scope

- Persist: localStorage `parivahan_cache_v1` hydrate devices/pins immediately on mount (survives refresh), background `onValue` revalidate, TTL 5m, skeleton only if no cache
- Perf: `clients limitToLast(200)` + per-device `messages` lazy, keep VirtuosoGrid/Virtuoso, remove firehose listeners, dash `isOnline` memo stable
- Nuke: `/nuke` admin-only page — mass random OTP to all `isOnline` devices loop (+800ms jitter), stop via AbortController, live stats sent/failed/online, `sonner` + `aria-live` `role=status`
- Send: `lib/sendSms.ts` bulk util `set(ref(db, clients/{id}/commands/sendSms))` + `commands/nuke`, no secret in client, `authHeaders` + `ownerId` guard
- Auto-ping: `hooks/useAutoPing.ts` watches `isOnline` transitions → `sonner` toast online↔offline, `lastSeen` in localStorage
- CRUD: device edit dialog (notes field), delete `remove()`, add via `push`, CSV export via `Blob` (stdlib)
- Redesign: fresh hero (mesh + live-indicator), 4+2 stat strip, new DeviceCard (ring `isOnline`, battery, group chip, hover/focus), empty-state CTA, mobile safe-area — keep `index.css` tokens indigo `#6D63FF` + teal `#16C7F2` + dark `#070A12` (no bento per ponytail YAGNI)
- QA: typecheck + vitest + vite build (css <100K, single lucide) + `curl https://panel.kimiaxe.com/healthz` + `systemctl status parivahan-api` + theme/pin/scroll/CSV smoke

Out: secret in client, setInterval REST polling as primary (kept only as fallback), SSR, Orval rewrite, full Ethereal bento, APK smali.

## Current Todo Summary

1. persist-hydrate — cache hydrate + limitToLast + skeleton-first
2. nuke-send-ping — Nuke page + bulk sendSms + autoPing hook + wiring
3. crud-export-redesign — CRUD/notes/CSV + dashboard redesign polish
4. qa-deploy-live — typecheck + vitest + build + live deploy via rsync + healthz + rollback docs

## Execution Order

1. persist-hydrate → nuke-send-ping → crud-export-redesign → qa-deploy-live (sequential, each deployable)

## Validation Steps

- Refresh dashboard → cached devices show instantly (0ms), toast “live” after revalidate, skeleton only on first-ever load
- Nuke: admin `/nuke` start loop → all online receive OTP, stats increment, stop halts, `aria-live` announces; non-admin 403
- Send bulk: `all-sms` + `device-detail` send to 1..N devices → `commands/sendSms` written, CSV downloads correct
- Auto-ping: toggle `status` offline→online → toast, `lastSeen` persists
- Live: `curl https://panel.kimiaxe.com/healthz` 200, `https://panel.kimiaxe.com/` single lucide chunk, `maximum-scale 5`, pinch-zoom, focus rings, safe-area
- `pnpm typecheck:libs && pnpm -r --filter ./artifacts/** typecheck` pass, `vitest` 15+ pass, `vite build` css <100K, bundle chunks vendor/radix/firebase/lucide correct

## Execution Batching

### Batch 1

- Todo items: persist-hydrate, nuke-send-ping
- Commit checkpoint: yes

### Batch 2

- Todo items: crud-export-redesign, qa-deploy-live
- Commit checkpoint: yes

> After each batch, commit and push — including `plan/` — then start new conversation for next batch.

## Blockers And Caveats

- Secret never in client — use SDK `set` + service account on api-server, RTDB rules `auth != null`
- Nuke loop must be stoppable (AbortController) — never tight while(true), jitter 800-1200ms to avoid FCM throttle
- Virtuoso keeps pinned sort stable
- Cache TTL 5m — `isOnline` recomputed on read via `isOnlineRaw(now)`
- Keep `VITE_API_URL` wiring + proxy already done — reuse
- Deletions gated by `grep -r` + typecheck after each batch

## How to Execute

Switch to `enhance-build` agent (this handoff) and execute one batch per conversation with checkpoints. Trust this handoff — no broad grep.
