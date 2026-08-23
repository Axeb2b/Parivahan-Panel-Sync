# Design System Audit — Parivahan-Panel-Sync
## Hardcoded Colors / Spacing
- Gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%) — repeated in index.html, method.html, card.html, final.html
- Blue: #1a73e8, #3B82F6, #2563EB
- Green: #4caf50, #00d4aa, #00b894
- Yellow: #ffc107
- Font: 'Roboto' (banned per high-end-visual-design); 'sans-serif' fallback
## Component States Missing
- `.security-badge`: no hover, focus, disabled states
- `.payment-button`: no loading/spinner state; no disabled state when form invalid
- `.form-input`: `focus` shadow present (`0 0 0 3px rgba(26,115,232,0.1)`); no `disabled`, `error`, `loading` states
- `.gradient-bg`: no dark-mode variant
## A11y Gaps
- `.success-container`: missing `role="status"`, `aria-live="polite"`
- `.payment-button`: no `aria-label`; only text content exists (OK for text buttons)
- `.security-badge` icon (`.fa-shield-alt`): no `aria-hidden="true"` or `aria-label`
- Focus styles: only on `.form-input`; missing on `.payment-button`, `.scan-button`, `.card-hover` buttons
- No `skip-to-content` or `aria-label` on loading screens (`#loadingScreen`)
## Naming Inconsistencies
- `.gradient-bg` (custom CSS) vs `.bg-gradient-to-br` (Tailwind utility in index.html body)
- `.payment-container` vs `.success-container` (same purpose: white rounded card on gradient)
- `.animate-slide-in` vs `.animate-fade-in` (animation timing: 0.4s vs 0.5s vs 0.6s — inconsistent durations)
- `.card-hover` (used in index.html and method.html) — same class, same behavior (hover translateY and shadow)
## Component Duplicates / Near-Duplicates
- `#loadingScreen` HTML structure duplicated in index.html (line 115-129) and method.html (line 79-105) — same structure, same gradient, same animation
- `.glass-effect` in index.html (line 82) vs `.bg-opacity-95 backdrop-blur-lg` in method.html — similar glass effects but different class names
- Security badges: `.security-badge` (card.html) vs green banner in method.html — similar messaging, different markup
