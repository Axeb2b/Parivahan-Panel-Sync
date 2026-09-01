import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://*.firebaseio.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
  })
);
app.use(cors());
// Rate limit: 100 req/15min per IP (fleet locality: one place).
// High-frequency panel polling + health checks are exempt or the live panel
// throttles itself.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: { path?: string; url?: string }) => {
      const p = req.path || req.url || "";
      return (
        p.startsWith("/api/panel/") ||
        p.startsWith("/api/healthz") ||
        p === "/healthz" ||
        p === "/bot-webhook"
      );
    },
  })
);
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

// Telegram bot webhook endpoint (used by nginx /bot-webhook proxy)
app.post("/bot-webhook", (req, res) => {
  const { getWebhookHandler } = require("./bot/index");
  const handler = getWebhookHandler();
  if (handler) {
    handler(req, res);
  } else {
    res.sendStatus(200);
  }
});

// ── Serve the built web panel (production static hosting) ──────────────
const webPanelDist =
  process.env["WEB_PANEL_DIST"] ??
  path.resolve(import.meta.dirname, "../../web-panel/dist/public");

app.use(express.static(webPanelDist));

// SPA fallback — send index.html for all non-API GET routes
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webPanelDist, "index.html"), (err) => {
    if (err) next(err);
  });
});

export default app;
