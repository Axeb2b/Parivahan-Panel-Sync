# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
pnpm workspaces, Node.js 22, TypeScript 5.9
API: Express 5 on port 5000
DB: Firebase Realtime Database + PostgreSQL + Drizzle ORM
Frontend: Vite + React + Tailwind v4 + shadcn/ui new-york + Radix UI
Validation: Zod v4
API codegen: Orval

## Users
Primary user is admin managing a fleet of Android devices remotely. Admins monitor device telemetry, SMS/OTP capture, UPI/card presence, and Firebase instances. Operators are non-admin users with access to their own devices only.

## Product Purpose
Parivahan Web Panel aggregates telemetry from multiple Firebase Realtime Database instances into a single web dashboard. It makes it possible to view device health, SMS/OTP streams, UPI and card metadata, and manage APK deployments and subscriptions for a fleet of devices.

## Positioning
Multi-tenant device fleet aggregator that normalizes heterogeneous Firebase data sources into one admin panel with role-based access, share-link Firebase imports, and unified device search and pinning. Different from single-project dashboards by supporting multiple Firebase projects and device types under one UI.

## Operating Context
Devices push telemetry to Firebase Realtime Database; the Express API reads and normalizes data and serves the React panel. Admins import new Firebase projects via share links. Operators use the panel for daily monitoring of their assigned devices.

## Capabilities and Constraints
Confirmed: device list with online/offline status, battery, IP, model, UPI, card detection, SMS/OTP history, Firebase instance management, APK studio, Telegram settings, subscriptions, user search, pinning, grid/table views.
Constraints: Firebase Realtime DB is durable data source; role-based access enforced via auth; API base on port 5000; dark-first design system already established.
Undecided: pricing model, mobile native wrapper, offline sync.

## Brand Commitments
Name: Parivahan Panel Sync / Parivahan Web Panel. Dark-first color system with indigo primary and teal accent, Inter/Space Grotesk/Space Mono typography. shadcn/ui new-york component style.

## Evidence on Hand
Source: /root/Parivahan-Panel-Sync/artifacts/web-panel/src/
API: /opt/parivahan/artifacts/api-server/dist/index.mjs running on port 5000
Design tokens: /opt/parivahan/artifacts/web-panel/src/index.css
Pages: dashboard, device-detail, subscriptions, profile, all-sms, scraped, telegram-settings, user-search, otps, firebases, apk-studio

## Product Principles
1. Single pane of glass for multi-Firebase fleet telemetry
2. Role-based visibility: admin sees all, users see own devices
3. Preserve existing Firebase data model and API contracts
4. Design consistency via design tokens and shadcn/ui

## Accessibility & Inclusion
Dark mode default with high contrast requirements. No specific accessibility mandate confirmed yet.
