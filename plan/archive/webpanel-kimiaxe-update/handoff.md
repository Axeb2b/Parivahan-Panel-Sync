## Feature Goal

- Update panel.kimiaxe.com web panel + debug P0 bugs + ponytail audit (delete dead Layout/ui/deps, env-wire Firebase, fix chunks/icons, virtualize fleet) + design-system polish + required skills installed — live-informed.

## Confirmed Scope

- Skills: link ponytail suite from cache to `~/.config/opencode/skills`, verify manager/vps-standard/websearch/continuous-plan/yolo-mode allow, verify impeccable detector for design-audit
- Delete duplicates: `src/layout.tsx` + `src/firebase.ts` + ~40 unused `ui/*` (keep ~12 used), uninstall zero-import deps, remove Zaraz/beacon + duplicate font @import if internal
- Fix P0: Firebase env wiring `VITE_FIREBASE_*` fallback axexodiweb, auth validate+expiry, XSS sanitize, messages `limitToLast(500)`, ping cleanup+unmount guard, wouter `setLocation`, alert→sonner, console DEV gate, viewport `maximum-scale 5`, dedupe font
- Design-audit: hardcoded colors, Roboto banned, missing hover/focus/disabled, a11y roles — polish current indigo/teal industrial (not full bento per ponytail YAGNI)
- Virtualize: dashboard `VirtuosoGrid` + all-sms + device-detail via already-installed `react-virtuoso`; Firebase `query(limitToLast(200))`; fix `hasCards` shadow + healthCells `Today` key → badge
- Prune: 57→~12 ui, remove deps (embla/framer/vaul/cmdk/input-otp/resizable), fix `manualChunks` radix regex + `lucide` coalesce, lazy Replit plugins
- Unify: `normalizeDevice` to `lib/db` workspace, dedupe `BANK_NAMES→RULES`, UX polish `VITE_API_URL` + tokens + skeletons + aria-live
- QA smoke via `https://panel.kimiaxe.com/healthz` + dashboard via cloudflared, `systemctl status parivahan-api`, bundle <500K raw

Out: APK smali, RTDB schema migration, pricing, native wrapper, Orval infinite-query rewrite, SSR/service-worker, full Ethereal Glass bento (Path B deferred).

## Current Todo Summary

1. skill-setup — install/link ponytail suite, verify 5 skills allow, record versions
2. audit-triage — ponytail baseline + reproduce (bundle 768K raw, 4 listeners, dup Layout)
3. design-audit — design-system audit via impeccable (hardcoded colors, states, a11y)
4. bugfix-critical — env wire + listener limits + ping cleanup + nav/toast/viewport/font
5. layout-consolidation — delete dup Layout/firebase, unify nav+theme, reduced-motion guard
6. perf-virtualize — Virtuoso lists, query limitToLast(200), fleet stats fix, key collision
7. deps-prune — delete 40 ui, uninstall deps, fix manualChunks + lucide, prune store
8. normalize-unify — move normalizeDevice to lib/db, merge BANK_NAMES
9. update-panel-ux — VITE_API_URL wiring, index.css tokens, skeletons, design-audit fixes
10. qa-deploy — typecheck + vitest + build (<500K raw) + cloudflared smoke + rollback + ponytail gain

## Execution Order

1. skill-setup → audit-triage → design-audit → bugfix-critical (Batch1: groundwork+bloat baseline+P0)
2. layout-consolidation → perf-virtualize → deps-prune (Batch2: layout/perf/bundle)
3. normalize-unify → update-panel-ux → qa-deploy (Batch3: shared lib + polish + verify)

## Validation Steps

- `ls ~/.config/opencode/skills/ponytail*` exists, `websearch` test, `manager` status ok
- `pnpm typecheck:libs && pnpm -r --filter ./artifacts/** typecheck` pass
- `vitest` fleetFilter/normalizeDevice pass
- `vite build` → bundle <500K raw / <150K gz, vendor/radix/firebase/lucide correctly chunked, no 40× icon waterfall, CSS <100K after prune, no console
- Dashboard: admin+non-admin visibleDevices, search/group/sort/pin, grid/table no reload, copy aria-live toast, virtuoso no jank at 300 devices, Today badge not filter
- Device-detail: ping pong latency + 15s timeout + cleanup, forward/sendSms 0-based, SMS virtuoso
- Live: `curl https://panel.kimiaxe.com/healthz` 200, `https://panel.kimiaxe.com/` single lucide chunk, viewport pinch-zoom, no font double-fetch, focus rings + roles
- `ponytail-gain` net: expected ~-3000 lines, -6 deps

## Execution Batching

### Batch 1

- Todo items: skill-setup, audit-triage, design-audit, bugfix-critical
- Commit checkpoint: yes

### Batch 2

- Todo items: layout-consolidation, perf-virtualize, deps-prune
- Commit checkpoint: yes

### Batch 3

- Todo items: normalize-unify, update-panel-ux, qa-deploy
- Commit checkpoint: yes

> After each batch, commit and push — including `plan/` — then start new conversation for next batch. Uncommitted plan files add token overhead.

## Blockers And Caveats

- Env missing → keep axexodiweb fallback + warn; never commit `.env`
- Deletions gated by `grep -r "from.*@/components/ui" + rg ui + pnpm ls` → typecheck after each delete
- Virtuoso keeps pinned secondary sort stable
- RateLimit scope to `/api` exempt `/healthz` + `/bot-webhook` — verify before tightening
- Zaraz/beacon removal confirm internal — keep if Cloudflare analytics needed
- Ponytail suite linkage is first todo — if fails, fallback to manual grep audit (no blocking)
- Fleet size unknown — Virtuoso always-on (cheap even for <100)
- Design: keep industrial dark, not full bento — unless user explicitly later wants Ethereal Glass

## How to Execute

Switch to `enhance-build` agent and start new conversation. `enhance-build` will read this handoff + plan.json (low token overhead) and execute one batch at a time with checkpoints.

Alternative: OpenCode's built-in code mode, but `enhance-build` follows batch checkpoints more strictly and loads fewer files at startup.
