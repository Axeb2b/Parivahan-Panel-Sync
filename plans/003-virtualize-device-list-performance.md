# Plan 003 — Virtualize device list for performance

## Context
Repo: /root/Parivahan-Panel-Sync/artifacts/web-panel
Commit: $(git rev-parse --short HEAD)
File: src/pages/dashboard.tsx

Current state: Dashboard renders all devices in grid/table without virtualization. With large fleets, DOM nodes grow linearly, causing jank and high memory.

## Goal
Virtualize the device list using TanStack Virtual or react-window to render only visible rows.

## Scope
In scope:
- src/pages/dashboard.tsx device grid/table rendering
- Add virtualization dependency if not present
- Preserve existing filters, sorting, pinning behavior

Out of scope:
- Backend pagination changes
- Design changes beyond performance

## Steps
1. Audit current render logic for filteredDevices
2. Install @tanstack/react-virtual if missing
3. Wrap grid/table container with virtualizer
4. Adjust item height estimation for card height
5. Preserve scroll position across filter changes
6. Run typecheck and manual performance test with 500+ mock devices

## Verification
- `pnpm --filter @workspace/web-panel typecheck` passes
- Scroll performance smooth with large dataset
- Filters/sort still work correctly

## Done criteria
- Virtualization implemented
- No regression in functionality

## Maintenance
Monitor item height changes after design updates.
