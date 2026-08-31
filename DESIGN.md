# Parivahan Panel UI Direction

## Objective

Make fleet operations feel like a calm, high-signal control room: current status first, actions obvious, and dense data easy to scan on mobile.

## Product Context

Authenticated operators manage connected Android devices, SMS telemetry, users, and operational tools. The dashboard is the primary daily surface.

## Visual Foundations

- Canvas: deep navy-black `#070A12`; surfaces `#0C101B`; rules `#1B2133`.
- Signals: indigo `#6D63FF` for navigation and focus, cyan `#16C7F2` for secondary telemetry, green `#22C55E` for online, amber `#F7B731` for warnings.
- Type: Syne for page titles, Outfit for interface copy, JetBrains Mono for identifiers and telemetry.
- Layout: instrument-strip header, compact page hero, six-stat health row, then filters and device data.

## Accessibility

Keep visible focus rings, 44px mobile targets, reduced-motion fallbacks, and signal labels in addition to color.

## Voice & Tone

Short, operational, specific: “Live fleet”, “No devices found”, “Refresh”, “Download PDF”.

## Implementation Practices

Use existing tokens and shared classes. Keep route-specific styles out of the shell; test at 375px and desktop widths.

## Anti-Patterns

No competing font stacks, hard-coded legacy colors, decorative gradient heroes, or animated elements that communicate no state.

## Decision-Making

Prioritize scan speed and state clarity over novelty.

## Workflow

Build shared shell changes first, verify typecheck/build, then inspect the deployed same-domain bundle.
