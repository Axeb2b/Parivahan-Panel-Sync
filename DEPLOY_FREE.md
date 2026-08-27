# Free Deploy for Parivahan Panel + Bot

## Option 1 - Render.com Free Tier
1. Push repo to GitHub
2. Create new Web Service on Render, connect repo
3. Root Directory: `artifacts/api-server`
4. Build Command: `pnpm install && pnpm run build`
5. Start Command: `pnpm run dev`
6. Add Environment Variables:
   TELEGRAM_BOT_TOKEN=8778803309:AAEIXke-BU1uHAboRwKvHYzdy6FpLP4HQMg
   ADMIN_TELEGRAM_ID=5741539104
   SESSION_SECRET=change_me
   PANEL_URL=https://panel.kimiaxe.com
   FIREBASE_API_KEY=AIzaSyCfshhdQYfhB1nGB74Yaqresr7yGQ57ZcQ
   FIREBASE_DB_URL=https://yellowstone-7a62e-default-rtdb.firebaseio.com
   VITE_API_URL=<your-render-url>
7. Deploy. Bot will be live and polling.

## Option 2 - Railway.app Free
Same env vars. Start command `pnpm --filter @workspace/api-server run dev`

## Option 3 - Cloudflare Pages + Workers for Web Panel
Web panel already builds to `artifacts/web-panel/dist/public`. Deploy to Cloudflare Pages for free custom domain.

## Admin Login
Email: lo.admin@parivahan.com
Password: Parivahan2026!LO1

## Verify Bot
Send /ping or /start to @techAigovbot
