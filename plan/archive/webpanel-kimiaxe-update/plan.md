## Metadata

- Last Updated: 2026-09-01 — Approved (Path A Ponytail Minimal) + skills wired
- Feature: webpanel-kimiaxe-update
- Status: approved
- Workspace: /root/Parivahan-Panel-Sync (panel.kimiaxe.com) + /root (multi-project)
- Language: English only

## User Request

- Goal: plan and update webpanel kimiaxe.com and debug bugs, ponytail audit n apply
- Follow-up 1: check live site and vision analyse the ui n frontend n upgrade plan
- Follow-up 2: more plan and install required skills for this — English only
- Context: Parivahan Panel Sync — multi-Firebase fleet aggregator (Express 5 api-server + Vite React web-panel). Live at https://panel.kimiaxe.com via cloudflared (CNAME panel.kimiaxe.com, .cloudflared/config.yml). User wants update + bug fixes + ponytail minimal pass + live vision upgrade + skills wiring.
- Constraints: enhance-plan mode — planning only, no implementation writes. Keep Firebase data model intact, preserve role-based access (admin bypass), keep panel deployable after each batch.

## Required Skills & Installation

### Why skills matter for this feature

- **Ponytail suite** — core of this request. Applied on every diff to rank deletions first. `ponytail-audit` scans whole repo (57 ui files, dup Layout, unused deps), `ponytail-review` ranks per-PR cuts, `ponytail-debt` tracks intentional shortcuts (e.g., Virtuoso even for <100), `ponytail-gain` measures bundle win.
- **Manager** — deploys live panel safely. Knows `parivahan-api.service` at `/opt/parivahan` port 5001, `systemctl status/journalctl` before restart, never deletes `bot.db/.env`, handles pnpm builds. Required for `qa-deploy` smoke via cloudflared.
- **VPS Standard** — 20G VPS at 58% after 2026-09-01 cleanup (freed 4.6G). Ensures disk before `vite build` / `pnpm store prune / journalctl --vacuum`, prunes dead `node_modules` duplicates. Prevents OOM during build.
- **Websearch Assistant** — fetches current docs for Vite 6 / Tailwind v4 / react-virtuoso 4.18 / Firebase JS SDK breaking changes without guessing. Used during `deps-prune` + `perf-virtualize`.
- **Continuous-Plan + Yolo-Mode** — keeps plan→build loop autonomous with `permission: allow`, batch checkpoints, low-token handoff (`handoff.md + plan.json` only).

### Skills Inventory (present on this VPS)

| Skill                                                                                       | Location                                                                                         | Status                                                | Installed via         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------- |
| ponytail / ponytail-audit / ponytail-review / ponytail-debt / ponytail-gain / ponytail-help | `/root/.cache/opencode/packages/@dietrichgebert/ponytail@latest`                                 | Cached, not yet linked to `~/.config/opencode/skills` | `cache` → link needed |
| continuous-plan                                                                             | `/root/.config/opencode/skills/continuous-plan`                                                  | Installed (enhance-plan + enhance-build agents)       | global 2026-09-01     |
| manager                                                                                     | `/root/.config/opencode/skills/manager`                                                          | Installed                                             | global                |
| vps-standard                                                                                | `/root/.config/opencode/skills/vps-standard`                                                     | Installed (freed 4.6G on 2026-09-01)                  | global                |
| websearch-assistant                                                                         | `/root/.config/opencode/skills/websearch-assistant`                                              | Installed (websearch + webfetch + cited)              | global 2026-09-01     |
| yolo-mode                                                                                   | `/root/.config/opencode/skills/yolo-mode`                                                        | Installed (permission allow)                          | global                |
| impeccable (design-system detector)                                                         | `Parivahan-Panel-Sync/.agents/skills/impeccable` + `/root/.config/opencode/skills/design-system` | Present (bundled detector for design-system drift)    | repo-bundled          |

### Installation Plan (todo `skill-setup` — planned, not executed in plan mode)

> Plan mode cannot run installs. The `skill-setup` batch will execute these in build mode before any code change.

1. **Link ponytail suite into opencode skills dir** (so `default.skill {name: ponytail-audit}` works without cache path):

   ```bash
   mkdir -p ~/.config/opencode/skills
   for s in ponytail ponytail-audit ponytail-review ponytail-debt ponytail-gain ponytail-help; do
     ln -sf /root/.cache/opencode/packages/@dietrichgebert/ponytail@latest/skills/$s ~/.config/opencode/skills/$s
   done
   # alternative: opencode skill install ponytail (if registry version)
   ```

   Verify: `ls ~/.config/opencode/skills/ponytail*` + `default.skill` load test.

2. **Verify manager + vps-standard + websearch** already `permission: allow`:

   ```bash
   systemctl status parivahan-api --no-pager | head -20
   df -h | grep sda1
   # websearch test:
   # websearch({query: "vite 6 tailwind v4 manualChunks 2026"})
   ```

3. **Enable design-system detector** (impeccable) for `design-audit`:

   ```bash
   node Parivahan-Panel-Sync/.agents/skills/impeccable/scripts/detector --help
   # or pnpm --filter @workspace/web-panel exec tsc --noEmit (design drift via @theme inline)
   ```

4. **Record installed versions** in `plan.md` appendix for reproducibility:
   - `pnpm --version` (10.34.5), `node --version` (v22.23.2), `vite --version`, `tailwindcss --version`

If any skill missing in build mode, `enhance-build` will fallback to manual `pnpm ls` + `grep` ponytail without skill, but with skill the audit is ranked and debt tracked.

## Live Site Vision (2026-09-01 fetch)

**URL:** `https://panel.kimiaxe.com/` — Vite SPA, no SSR.

```html
<script type="module" src="/assets/index-DFmKEkSz.js">
<link rel="modulepreload" href="/assets/vendor-CusAUaJV.js">   <!-- react, react-dom, wouter -->
<link rel="modulepreload" href="/assets/radix-Ch64xJyE.js">     <!-- ONLY 3 radices chunked -->
<link rel="modulepreload" href="/assets/firebase-BN_EWluE.js"> <!-- app + database -->
<link rel="modulepreload" href="/assets/charts-CYIiYnT6.js">   <!-- recharts -->
<link rel="stylesheet" href="/assets/index-DXkHmrWL.css">      <!-- 144K -->
+ Zaraz + beacon (330c075...), fonts Outfit/Syne/JetBrains Mono via Google
```

**Dist sizes (raw, not gz):** `index 340K | firebase 156K | index.css 144K | radix 44K | device-detail 40K | dashboard 24K | vendor 20K | +40×4K lucide fragments ≈768K raw / ~220K gz` — heavy for India mid-range (parse >1s).

**Vision findings:**

- Shell: `#root` empty until JS, dark `#070A12` inline flash before CSS, `maximum-scale=1` blocks pinch-zoom (WCAG 1.4.4), `noindex/nofollow` correct, Zaraz+beacon cost for internal panel — remove.
- Design system: `src/index.css` single source GOOD — vars light `210 20%98%` / dark `228 32%5%`, `@theme inline`, `@custom-variant dark`, utilities `page-eyebrow/title/stat-card/sig-dot/app-shell/page-hero/live-indicator`, indigo `239 84%60%` + teal, `prefers-reduced-motion` for card-scan. BUT duplicate `#070A12` inline + Google Fonts `@import` duplicates HTML `<link>`.
- Layout duplication P0: `src/layout.tsx 139L` vs `src/components/layout.tsx 243L`, app uses latter, former dead (stale routes /tool,/pam) — delete.
- Component bloat: `src/components/ui 57 files 6073L`, only ~12 imported (button/card/badge/tabs/tab-bar/input/select/dialog/dropdown/popover/skeleton/sonner/table), 40+ unused (sidebar 726L, chart 366L, carousel 259L, menubar 253L…) → CSS+JS bloat.
- ManualChunks lie: only 3 Radix chunked → 21 Radix + cmdk/framer/vaul/embla → index; lucide split 40×4K → waterfall. Vendor tiny (20K) leaks to index via catalog.
- Login ParticleField 60 dots O(n²) rAF, no reduced-motion — battery drain.
- Dashboard: grid `2→3→6` + table `hidden sm:block` good, but healthCells `key:"all"` collision (Today sets filter all), bank filter inert, table row `window.location.href` reload.
- Perf: 4 parallel `onValue` (clients/otps/latest/pins/messages) full trees, no `limitToLast/query`, no Virtuoso despite installed 4.18.12 — `.map` over full arrays → >5K DOM nodes, OOM.
- Mobile: new layout responsive (sidebar hidden md:flex, drawer slide-in, safe-area, 16px iOS anti-zoom) good.
- A11y: `select-none` on buttons, `maximum-scale=1`, clipboard no aria-live — low.

## Core Requirement Analysis

- In-scope:
  - Ponytail audit (src/** + api-server fleet/routes/app) — now live-informed + design-system audit
  - P0 bug fixes (hardcoded firebase, firehose listeners, dup Layout/firebase.ts, ping leak, nav, viewport, double font, console)
  - Panel update (env wiring, design tokens polish, mobile drawer, chunking, tracker removal)
  - Prune deps/components (57→~12 ui, remove zero-import deps), virtualize lists, unify normalizeDevice
  - Skills installation + verification
  - QA smoke via panel.kimiaxe.com + healthz + ponytail gain measurement
- Out-of-scope:
  - APK smali rebrand, RTDB schema migration, pricing/billing, native wrapper, Orval infinite-query rewrite (Path B), SSR/service-worker, full Ethereal Glass bento redesign (ponytail YAGNI — keep industrial dark, polish only)
- Affected areas:
  - `artifacts/web-panel/src/{pages/dashboard,device-detail,login,all-sms,otps,App,layout,lib/*,components/ui/*,hooks/*,index.css,vite.config.ts}`
  - `artifacts/web-panel/{index.html,package.json,dist/public/assets}`
  - `artifacts/api-server/src/{app.ts,fleet/*,routes/*,lib/logger,middlewares/*}`
  - `lib/{db,api-spec,api-client-react}` shared
  - `scripts/deploy-panel.sh`, `.cloudflared/config.yml`, `.env.example`, `docs/design-system-audit.md`
  - Env: `VITE_API_URL`, `VITE_FIREBASE_*`, `PANEL_URL`, `WEB_PANEL_DIST`, `ADMIN_TELEGRAM_ID`

## Technical Approach

- Existing system relationship:
  - web-panel reads RTDB directly via `firebase/database` onValue (clients, messages, otps/latest, pins). api-server aggregates via `rtdbFleet.ts`, serves `/api/*` + static `dist/public`. Cloudflared → nginx → api-server.
  - Duplication: normalizeDevice web-panel ↔ api-server divergent online rule; 57 ui → ~12 used; two Layouts; smsClassifier BANK_NAMES vs RULES dup; firebase.ts duplicated; impeccable detector already bundled but unused.
- Key implementation idea (ponytail ladder — live + design informed):
  1. **Delete what shouldn't exist:** dup Layout/firebase.ts, 40+ unused ui/*.tsx (grep `from.*@/components/ui`), dead deps (framer/embla/vaul/cmdk/input-otp/resizable if zero imports), Zaraz/beacon for internal, duplicate Google Fonts @import. ~30-40% CSS/JS drop, zero risk.
  2. **Reuse what exists:** already-installed `react-virtuoso` for all lists (not new virtualizer); `hasCards/getBatteryValue` from fleetFilter not shadow; `cn()` util; impeccable detector for design-audit instead of new linter.
  3. **Stdlib/native first:** `Intl.DateTimeFormat` replaces `date-fns/format 20K`; CSS `@keyframes` for card-scan/ring-glow not framer; `crypto.getRandomValues` not Math.random; native viewport fix.
  4. **Fewest files:** unify normalizeDevice to `lib/db` workspace package (shim for compat).
  5. **One-liners:** `window.location.href→setLocation`, `alert→toast`, `console→DEV gate`, `maximum-scale 1→5`, `firebaseConfig→VITE_FIREBASE_*` fallback, `manualChunks` radix regex `id.includes('@radix-ui')` + `lucide:["lucide-react"]` coalesce.
- Data flow / coordination:
  - Env: `lib/firebase.ts` reads `import.meta.env.VITE_FIREBASE_*` fallback axexodiweb, warn if missing; `WEB_PANEL_DIST` static unchanged.
  - Fleet: dashboard 2 listeners (clients+ pins) + `query(limitToLast(200), orderByChild lastPing)` + Virtuoso overscan 400; health stats single useMemo no shadow.
  - Normalize: shared `normalizeDevice` from `@workspace/db` (add `device.ts`), both consumers import it.
  - Build: `vite.config.ts` manualChunks fixed, dedupe @import, lazy `() => import()` for Replit plugins — prod drops 40 icon requests → 1 lucide chunk.
  - Design: keep current indigo/teal industrial (not full bento). Only apply audit fixes: missing hover/focus/disabled states, `role="status"` + `aria-live`, focus rings, naming dedupe. Bento Double-Bezel deferred as ponytail YAGNI.

## Task Breakdown (10 todos)

1. **skill-setup** — Link ponytail suite into `~/.config/opencode/skills`, verify manager/vps-standard/websearch/continuous-plan/yolo-mode `permission: allow`, verify impeccable detector help, record `pnpm/node/vite/tailwind` versions. No code, just linkage. Skills: `ponytail-audit, manager, vps-standard, websearch-assistant`.
2. **audit-triage** — Ponytail baseline: `pnpm typecheck`, `vite build` analyze (768K raw baseline table), `grep -r "from.*@/components/ui"` mark unused ui, `pnpm ls --depth=0` flag deps, reproduce P0 (hardcoded firebase, Layout dup, firehose, ping leak, table reload, viewport, double font, Zaraz). Skills: `ponytail-audit` (ranked list `delete/stdlib/native/yagni/shrink`), `vps-standard` (df before build), `websearch` (vite/tailwind docs if needed).
3. **design-audit** — Frontend design-system audit: scan `src/index.css` tokens, `docs/design-system-audit.md` hardcoded colors `#667eea/#764ba2/#1a73e8/#ffc107/#4caf50`, Roboto banned per high-end-visual-design, missing states on `.security-badge/.payment-button/.form-input`, a11y gaps (`aria-label`, `role status`, focus), naming `gradient-bg` vs `bg-gradient-to-br`, duplicates `#loadingScreen`. Use `impeccable` detector + `design-system` skill rules. Keep industrial dark, do not rewrite to bento. Skills: `impeccable`, `manager` (no visual change yet).
4. **bugfix-critical** — Env-wire `firebaseConfig→VITE_FIREBASE_*` fallback + warn, auth `cyberzone_auth` validate shape+expiry+clear malformed, search/SMS `esc()` sanitize, `messages` `limitToLast(500)` per device, ping track timeout+unsubscribe refs clear on unmount + guard `isSended` loop, `window.location.href→setLocation`, `alert→sonner`, `console DEV gate`, `maximum-scale 5`, dedupe Google Fonts @import, remove Zaraz/beacon if internal analytics not needed (or keep if Cloudflare analytics required). Skills: `manager` (env .env not committed), `websearch` (Firebase JS SDK env pattern).
5. **layout-consolidation** — Delete `src/layout.tsx` + `src/firebase.ts` dead, keep `components/layout.tsx` canonical, single `navLinks` filtered by isAdmin, unify theme `parivahan-theme` dark default remove ThemeProvider dup, drawer escape+route close, ParticleField reduced-motion guard `matchMedia('(prefers-reduced-motion: reduce)')` + `count Math.min(30, …)`. Skills: `ponytail-review` (verify no single-use interface left).
6. **perf-virtualize** — Replace dashboard `filteredDevices.map` → `<VirtuosoGrid>` overscan 400, `all-sms` slice 50 → Virtuoso, `device-detail` SMS list Virtuoso `max-h-[560px]`; Firebase `query(limitToLast(200), orderByChild lastPing)` for clients/messages; delete `hasCards` shadow → import, numeric Today compare, fix healthCells `Today` key → badge not filter. Skills: `websearch` (react-virtuoso 4.18 API), `ponytail` (one-line swap).
7. **deps-prune** — Delete ~40 unused `ui/*.tsx` (keep: button/card/badge/tabs/tab-bar/input/select/dialog/dropdown/popover/skeleton/sonner/toaster/alert/table/avatar if used), uninstall zero-import deps `embla-carousel-react, framer-motion (keep if apk-studio uses), input-otp, react-resizable-panels, cmdk, vaul` via `pnpm remove` + `pnpm store prune`, fix `manualChunks` radix regex + `lucide` chunk, strip Replit `await import` top-level to lazy. Skills: `vps-standard` (prune + df after), `ponytail-debt` (mark `// ponytail: chart kept for /scraped` if kept).
8. **normalize-unify** — Move `normalizeDevice + NormalizedDevice + isOnline` to `lib/db/src/device.ts` export `@workspace/db`, shim `web-panel/lib/normalizeDevice.ts` re-export for compat, `api-server/fleet` imports same; merge `BANK_NAMES→RULES` single source in smsClassifier, `// ponytail: keyword heuristic, LLM if precision matters`. Skills: `ponytail-review` (shrink duplicate).
9. **update-panel-ux** — Wire `VITE_API_URL` (`https://panel.kimiaxe.com` prod / `/api` dev proxy via vite), unify `index.css` tokens remove inline `#070A12` flash, skeletons + copy `aria-live` + sonner, mobile drawer safe-area, apply design-audit fixes (focus rings, `role status`, disabled states) — keep indigo/teal industrial, not bento. Skills: `vps-standard` (verify dist size), `manager` (check cloudflared config).
10. **qa-deploy** — `pnpm typecheck:libs && pnpm -r --filter ./artifacts/** typecheck`, `vitest` fleetFilter/normalizeDevice, `vite build` diff bundle before/after target `<500K raw / <150K gz`, local serve `dist/public` via api-server, smoke `https://panel.kimiaxe.com/` + `/healthz` via cloudflared `curl -w %{http_code} time`, `systemctl status parivahan-api`, verify bottom nav safe-area + theme persistence + no console errors, document rollback `scripts/deploy-panel.sh` curl check + `ponytail-gain` net lines/deps. Skills: `manager` (restart + journalctl), `vps-standard` (disk after build), `ponytail-gain`.

## Risks And Open Questions

- Risks:
  - Deleting ui breaks lazy chunk if dynamic import missed → `grep -r "from.*@/components/ui" + rg ui + typecheck` after each batch
  - Env missing breaks axexodiweb fleet → keep fallback + warn
  - Virtuoso changes scroll/pin sort → keep pinned secondary sort stable, test with pinnedIds
  - Shared normalizeDevice changes online threshold (5m vs boolean) → preserve exact isOnline logic + test vector
  - Global rateLimit 100/15m throttles panel polling → scope to `/api` exempt `/healthz` + `/bot-webhook`
  - Zaraz removal breaks Cloudflare Web Analytics — confirm internal panel needs it (likely not)
  - Ponytail suite not linked → audit falls back to manual grep, no ranked gain — mitigated by skill-setup first
- Open questions: see plan.json/openQuestions (10) — Firebase canonical, classifier merge, ponytail intensity, fleet size, auth storage, recharts usage, ParticleField keep, Zaraz keep, bento vs industrial, skills linking.

## Validation

- Functional:
  - Dashboard: admin+non-admin visibleDevices string-coerced, search/group/sort/pin, grid/table no reload, copy toast aria-live, healthCells correct, virtuoso no jank at 300 devices, Today badge not filter
  - Device-detail: ping pong latency + 15s timeout + cleanup on nav away; call/sms forward + sendSms 0-based from; SMS virtuoso bank/otp marks, sender/message/dateTime + fallback
  - Live: single lucide chunk not 40, vendor/radix/firebase correctly chunked, viewport pinch-zoom works, no font double-fetch, no Zaraz if removed, share-link ?s= via toast, focus rings + roles
  - Skills: `ls ~/.config/opencode/skills/ponytail*` exists, `websearch` test passes, `manager` pre/post status ok
- Build/test:
  - `pnpm typecheck` libs+artifacts pass
  - `vitest` passes
  - `vite build` manualChunks vendor/radix/firebase/charts/lucide only, bundle <500K raw, CSS <100K after prune, no console, cloudflared curl 200 <800ms
  - `ponytail-gain` reports `net: -<N> lines, -<M> deps` (expected ~-3000 lines, -6 deps)

## Option Paths

### Path A — Ponytail Minimal (Recommended)

- Applicability: Fix bugs, delete bloat, reuse Virtuoso, stdlib/native, no new abstractions — live-informed deletions ~35% bundle drop, keep industrial dark tokens
- Advantages: Smallest diff, lowest risk, reuses installed Virtuoso, fastest to panel, preserves RTDB, each batch deployable
- Costs: Leaves debt (manual listeners not TanStack infinite query, keeps indigo/teal not bento)
- Risks: Low — gated deletions, live stays up
- Impact: Batches 1–3 shippable independently

### Path B — Full Rewrite

- Applicability: Orval infinite queries, Ethereal Glass bento Double-Bezel, extract classifier package, full zod, SSR
- Advantages: Cleaner long-term, high-end visuals, proper pagination
- Costs: 2–3x diff, every page, delays P0, needs RTDB migration, designer needed, longer QA, live risk
- Risks: Medium-high — blast radius, longer QA
- Impact: Single big batch, blocks incremental deploy

Recommended: Path A

## Confirmation State

- Current state: approved
- Execution approved: true
- Approved path: Path A — Ponytail Minimal
- Approval date: 2026-09-01
- Next: Switch to `enhance-build` agent — it will read `handoff.md + plan.json` (low token) and execute Batch 1 → 3 with commit checkpoints. Alternative: OpenCode built-in code mode (but `enhance-build` follows batch checkpoint discipline more strictly).

## Ponytail Audit Appendix (Baseline 2026-09-01 + Live Vision)

| #   | Location                                                | Finding                                                                                                                                | Action                                                              | Severity      |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------- |
| 1   | `web-panel/src/layout.tsx` 139L                         | Duplicate of `components/layout.tsx` — dead stale routes                                                                               | Delete src/layout.tsx, keep components/layout                       | High          |
| 2   | `web-panel/src/firebase.ts`                             | Duplicate of `lib/firebase.ts` hardcoded — double init                                                                                 | Delete duplicate                                                    | High          |
| 3   | `web-panel/src/components/ui` 57 files 6073L            | ~40 unused (sidebar 726L, chart 366L, carousel 259L, menubar 253L…)                                                                    | Delete after grep                                                   | High (bundle) |
| 4   | `web-panel/package.json`                                | `framer-motion, embla, vaul, cmdk, input-otp, resizable-panels` unused/rarely                                                          | Uninstall zero-import                                               | Medium        |
| 5   | `web-panel/dist raw 768K`                               | manualChunks only 3 Radix → 21 Radix leak to index; 40×4K lucide waterfall                                                             | Fix radix regex + lucide chunk                                      | High          |
| 6   | `web-panel/index.css 144K`                              | Tailwind emits all ui utils including dead; duplicate Google Fonts @import                                                             | Delete dead ui + remove CSS @import                                 | Medium        |
| 7   | `web-panel/index.html` viewport                         | `maximum-scale=1` blocks zoom                                                                                                          | →5                                                                  | Low (a11y)    |
| 8   | `web-panel/src/lib/firebase.ts:6`                       | Hardcoded axexodiweb shipped                                                                                                           | Env-wire VITE_FIREBASE_* fallback                                   | High          |
| 9   | `web-panel/src/pages/dashboard 4 listeners`             | clients/otps/latest/pins/messages full trees, no limit                                                                                 | limitToLast + query + Virtuoso                                      | High (perf)   |
| 10  | `web-panel react-virtuoso 4.18.12`                      | Installed never imported — .map full arrays                                                                                            | Use VirtuosoGrid/Virtuoso                                           | High          |
| 11  | `web-panel/src/pages/dashboard hasCards shadow`         | Inline shadows import                                                                                                                  | Reuse import                                                        | Low           |
| 12  | `web-panel/src/pages/dashboard healthCells`             | Total+Today both key:"all" collision                                                                                                   | Fix Today key → badge                                               | Low           |
| 13  | `web-panel/src/pages/dashboard table`                   | `window.location.href` reload                                                                                                          | setLocation                                                         | Low           |
| 14  | `web-panel/src/App ShareLinkImporter`                   | `alert()` blocking                                                                                                                     | sonner toast                                                        | Low           |
| 15  | `web-panel/src/pages/dashboard console.error`           | Leftover                                                                                                                               | Gate DEV                                                            | Low           |
| 16  | `web-panel/src/pages/device-detail ping`                | No unmount cleanup, set(null) loop                                                                                                     | Track refs, clear on unmount                                        | Medium        |
| 17  | `web-panel/src/lib/normalizeDevice vs api-server/fleet` | Duplicated isOnline                                                                                                                    | Unify to lib/db                                                     | Medium        |
| 18  | `web-panel/src/lib/smsClassifier BANK_NAMES`            | Duplicates RULES BANK kws                                                                                                              | Merge single source                                                 | Low           |
| 19  | `web-panel/src/pages/login ParticleField`               | 60 dots O(n²) rAF no reduced-motion                                                                                                    | Guard +30 dots                                                      | Medium        |
| 20  | `web-panel src/index.html Zaraz+beacon`                 | Internal panel loads Zaraz/beacon before app                                                                                           | Remove if no analytics                                              | Medium        |
| 21  | `web-panel src/hooks use-mobile/use-toast`              | Unused duplicates sonner                                                                                                               | Delete unused                                                       | Low           |
| 22  | `api-server/src/app rateLimit 100/15m global`           | Throttles /healthz+webhook                                                                                                             | Scope to /api exempt                                                | Medium        |
| 23  | `web-panel src/lib/auth cyberzone_auth`                 | Plain localStorage no expiry                                                                                                           | Validate+expiry clear malformed                                     | Medium        |
| 24  | `web-panel dist lucide 40×4K`                           | Per-icon chunks waterfall                                                                                                              | Coalesce to single lucide chunk                                     | Medium        |
| 25  | `docs/design-system-audit.md`                           | Hardcoded #667eea/#764ba2/#1a73e8 etc, Roboto banned, missing hover/focus/disabled/loading states, a11y gaps (role, aria-label, focus) | Polish tokens + states per audit, keep indigo/teal (not full bento) | Medium        |

Skipped YAGNI: Custom cache engine, SSR, service-worker, new design tokens bento, splitting 1400L device-detail monolith, i18n — add when measured need. // ponytail: deletions first, abstractions later.

## Live Bundle Baseline (for ponytail gain)

Before: `index 340K + firebase 156K + index.css 144K + radix 44K + device-detail 40K + dashboard 24K + vendor 20K + 40×4K icons ≈768K raw / ~220K gz`
Target after Path A Batch2: `<500K raw / <150K gz` (ui prune ~40K CSS, icon coalesce -30 requests, radix/vendor correctly split)

## Design System Note (frontend-upgrade-spec.md Tasks 4-6)

Original spec proposed Ethereal Glass (OLED #050505, radial mesh, Double-Bezel, Geist font, asymmetric bento) per `high-end-visual-design`. For this internal fleet ops panel, ponytail recommendation is to **keep current industrial dark** (indigo `#4F46E5`/`#6D63FF` + teal `#0EA5E9`) and only apply audit fixes (focus states, roles, disabled, naming dedupe, mobile collapse). Full bento adds ~2x diff for little ops gain — defer to Path B if user explicitly wants luxury vibe later.
